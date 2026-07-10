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
