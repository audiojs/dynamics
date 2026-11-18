import { writer, concat, clamp } from './util.js'
import { shape } from './shape.js'

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

// The streaming form the manifest runs: each sample's N points (`oversample` N > 1) read through the same 32-tap
// Lanczos kernels @audio/resample-sinc reads them with (shape.js: up, the curve, down), from rings, one sample at a
// time. The kernels reach ahead of the sample they make (16 input samples up, 16 points down), so a sample comes out
// `oversampler(N).latency` = 15 + ⌈17/N⌉ samples after it went in: 24, 21, 20, 19, 18, 18, 18 for N = 2 … 8. Each
// point is the same sum of the same products, in the same order, divided by the kernel's whole sum; a whole call divides
// a kernel the signal's edges cut short by what is left of it, so the two part only within the kernels' reach of
// either end (and, for N not a power of two, where the whole call's position j/N rounds to another phase: the
// resampler steps by the double nearest 1/N).

const HALF = 16, sinc = x => x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x)
/** The curves, in the order a block's `k[0]` names them. */
export const CURVES = ['tanh', 'atan', 'cubic', 'sin', 'hard']

/** An N-times oversampler's kernels, as resample(…, { from, to }) weighs its taps: up, phase p's 32 weights at x = t −
 *  p·(1/N) (t = −15 … 16; the phase of the first N points), and their sum; down, the weights at x = t·(1/N) and their
 *  sum. `latency`: samples a point's sample comes out after it goes in. */
export function oversampler (N) {
  let rate = 1 / N, up = new Float64Array(32 * N), upSum = new Float64Array(N), down = new Float64Array(32), sums = new Float64Array(1)
  for (let p = 0; p < N; p++) {
    let pos = p * rate, frac = pos - Math.floor(pos), w = 0
    for (let t = 1 - HALF; t <= HALF; t++) { let x = (t - frac) * 1, k = sinc(x) * sinc(x / HALF); up[32 * p + t + 15] = k; w += k }
    upSum[p] = w
  }
  let w = 0
  for (let t = 1 - HALF; t <= HALF; t++) { let x = (t - 0) * rate, k = sinc(x) * sinc(x / HALF); down[t + 15] = k; w += k }
  sums[0] = w
  return { N, up, upSum, down, downSum: sums, latency: 15 + Math.ceil(17 / N) }
}

/** One channel's state for softclipBlock: its position (Float64Array(2)); the last 32 samples, written twice so any 32
 *  in a row lie in order (Float64Array(64)); the last 64 points, the same way (Float32Array(128)). */
export const softclipState = () => ({ at: new Float64Array(2), xs: new Float64Array(64), ps: new Float32Array(128) })

/** One block of one channel into `out` (which may be `x`), allocating nothing. `k`: Float64Array(4), the curve (its
 *  index in CURVES), drive, ceiling, and π·drive/2 (atan's slope). `os`: oversampler(N), or null to shape each sample
 *  as it is; `st`: softclipState(), the delay's samples and points. Oversampled, `out` lags `x` by `os.latency`. `g`:
 *  the drive and the ceiling for each sample, as a host's ramp moves them (Float64Array, from 0 and M), written into `k`
 *  sample by sample (an oversampled sample's N points take its own); empty (the default), `k`'s. */
export function softclipBlock (x, out, k, os, st, g = NONE, M = 0) {
  if (os) return oversampled(x, out, k, os, st, g, M)
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
function oversampled (x, out, k, os, st, g, M) {
  let N = os.N, up = os.up, us = os.upSum, dn = os.down, ds = os.downSum[0], o = Math.ceil(17 / N) * N - 17
  let xs = st.xs, ps = st.ps, d = st.at[0] | 0, u = st.at[1] | 0, ramp = g.length > 0
  for (let i = 0; i < x.length; i++) {
    if (ramp) { k[1] = g[i]; k[2] = g[M + i]; k[3] = Math.PI * k[1] / 2 }
    xs[d] = xs[d + 32] = x[i]
    d = (d + 1) & 31
    // the N points after the sample 16 back: xs[d … d + 31] are the samples 31 back to this one
    for (let p = 0, q = 0; p < N; p++, q += 32) {
      let sum = 0
      for (let t = 0; t < 32; t++) sum += xs[d + t] * up[q + t]
      ps[u] = sum / us[p]
      curve(ps, u, ps, u, k)
      ps[u + 64] = ps[u]
      u = (u + 1) & 63
    }
    // the sample `latency` back, from the 32 points around its own: they end o points before the newest
    let sum = 0
    for (let t = 0, j = u + 32 - o; t < 32; t++) sum += ps[j + t] * dn[t]
    out[i] = sum / ds
  }
  st.at[0] = d; st.at[1] = u
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
