import { writer, concat, clamp } from './util.js'
import { shape } from './shape.js'
import { oversampler, up, down } from '@audio/resample-sinc'

// Static waveshaping — no envelope, no time state. Deterministic per-sample
// transfer curve. For controlling peaks without pumping; preferred over
// `limiter` when gentle saturation / harmonic coloration is desired.
//
// `oversample` (1|2|4|8, default 1) runs the transfer at N× rate and decimates
// back down (windowed-sinc, anti-aliased) — hard/high-drive clipping generates
// harmonics above Nyquist that otherwise fold back as audible aliasing. Pattern
// mirrors @audio/saturate (see shape.js). Default 1 is the exact prior behavior
// — no resampling, byte-identical to the pre-oversampling implementation.
export default function softclip(data, opts = {}) {
  if (!(data instanceof Float32Array)) return writer(softclipStream(data))
  let fn = shaper(opts)
  return shape(data, fn, { fs: opts.fs ?? 44100, oversample: opts.oversample ?? 1 })
}

export function softclipStream(opts = {}) {
  let fn = shaper(opts)
  let fs = opts.fs ?? 44100
  let oversample = opts.oversample ?? 1

  if (oversample <= 1) {
    return {
      write(chunk) {
        let out = new Float32Array(chunk.length)
        for (let i = 0; i < chunk.length; i++) out[i] = fn(chunk[i])
        return out
      },
      flush() { return new Float32Array(0) }
    }
  }

  // Sinc oversampling needs whole-signal context — per-chunk resampling would
  // seam at chunk edges. @audio/saturate ships no streaming form at all for its
  // oversampled atoms (batch only); here that same constraint is expressed
  // through the family's {write, flush} shape by buffering writes and shaping
  // once on flush().
  let buf = new Float32Array(0)
  return {
    write(chunk) { buf = concat(buf, chunk); return new Float32Array(0) },
    flush() {
      let out = shape(buf, fn, { fs, oversample })
      buf = new Float32Array(0)
      return out
    }
  }
}

// The streaming form the manifest runs: each sample's N points (`oversample` N > 1) through @audio/resample-sinc's
// oversampler, on the arithmetic the whole call resamples with (shape.js: up, the curve, down), its history carried from
// call to call. The whole call reads `latency` samples ahead of a sample (31, at any N from 2), so a sample comes out
// that many samples after it went in. Each point is the same sum of the same products, in the same order, divided by
// the kernel's whole sum; a whole call divides a kernel the signal's edges cut short by what is left of it, so the two
// part only within the kernels' reach of either end.

/** The curves, in the order a block's `k[0]` names them. */
export const CURVES = ['tanh', 'atan', 'cubic', 'sin', 'hard']

/** An N-times oversampler for softclipBlock, one a channel, for blocks of up to `maxBlockSize` samples:
 *  @audio/resample-sinc's. `latency`: samples a sample comes out after it goes in. */
export { oversampler }

/** One block of one channel into `out` (which may be `x`), allocating nothing. `k`: Float64Array(4), the curve (its
 *  index in CURVES), drive, ceiling, and π·drive/2 (atan's slope). `os`: the channel's oversampler(N, maxBlockSize), or
 *  null to shape each sample as it is; oversampled, `out` lags `x` by `os.latency`. `g`: the drive and the ceiling for
 *  each sample, as a host's ramp moves them (Float64Array, from 0 and M), written into `k` sample by sample (an
 *  oversampled sample's N points take its own); empty (the default), `k`'s. */
export function softclipBlock (x, out, k, os, g = NONE, M = 0) {
  if (os) return oversampled(x, out, k, os, g, M)
  let ramp = g.length > 0
  for (let i = 0; i < x.length; i++) {
    if (ramp) { k[1] = g[i]; k[2] = g[M + i]; k[3] = Math.PI * k[1] / 2 }
    curve(x, i, out, i, k)
  }
  return out
}
const NONE = new Float64Array(0)

// softclipBlock oversampled: a function of its own. In one function with the other path, an instance oversampling after
// one that did not allocated as it ran (Node 25: 288 collections in the family test's 2^17 blocks), as V8 had compiled
// these loops before they ran
function oversampled (x, out, k, os, g, M) {
  let N = os.factor, hi = os.hi, n = x.length, ramp = g.length > 0
  up(os, x, n)
  for (let i = 0, j = 0; i < n; i++) {
    if (ramp) { k[1] = g[i]; k[2] = g[M + i]; k[3] = Math.PI * k[1] / 2 }
    for (let e = j + N; j < e; j++) curve(hi, j, hi, j, k)
  }
  down(os, out, n)
  return out
}

// dst[j] = the curve k[0] (CURVES' index) at src[i], as shaper() makes it. Only arrays and indices cross the call: a
// number V8 passes to or returns from a call it does not inline is a new object
function curve (src, i, dst, j, k) {
  let cu = k[0], dr = k[1], ce = k[2], v = src[i]
  if (cu === 0) dst[j] = ce * Math.tanh(dr * v)
  else if (cu === 1) dst[j] = ce * Math.atan(k[3] * v) * (2 / Math.PI)
  else if (cu === 2) { let w = clamp(dr * v, -1, 1); dst[j] = ce * (1.5 * w - 0.5 * w * w * w) }
  else if (cu === 3) dst[j] = ce * Math.sin(Math.PI / 2 * clamp(dr * v, -1, 1))
  else dst[j] = clamp(dr * v, -ce, ce)
}

// Transfer curve factory. All curves map (-∞, +∞) → [-ceiling, +ceiling].
export function shaper(opts = {}) {
  let curve = opts.curve || 'tanh'
  let drive = opts.drive ?? 1
  let ceiling = opts.ceiling ?? 1
  if (curve === 'tanh') return (x) => ceiling * Math.tanh(drive * x)
  if (curve === 'atan') {
    let k = Math.PI * drive / 2
    return (x) => ceiling * Math.atan(k * x) * (2 / Math.PI)
  }
  if (curve === 'cubic') return (x) => {
    let v = clamp(drive * x, -1, 1)
    return ceiling * (1.5 * v - 0.5 * v * v * v)
  }
  if (curve === 'sin') return (x) => ceiling * Math.sin(Math.PI / 2 * clamp(drive * x, -1, 1))
  if (curve === 'hard') return (x) => clamp(drive * x, -ceiling, ceiling)
  throw new Error(`unknown curve: ${curve}`)
}
