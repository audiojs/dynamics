import { writer, clamp } from '@audio/dynamics-core'

// Static waveshaping — no envelope, no time state. Deterministic per-sample
// transfer curve. For controlling peaks without pumping; preferred over
// `limiter` when gentle saturation / harmonic coloration is desired.
export default function softclip(data, opts) {
  if (!(data instanceof Float32Array)) return writer(softclipStream(data))
  let shape = shaper(opts)
  let out = new Float32Array(data.length)
  for (let i = 0; i < data.length; i++) out[i] = shape(data[i])
  return out
}

export function softclipStream(opts = {}) {
  let shape = shaper(opts)
  return {
    write(chunk) {
      let out = new Float32Array(chunk.length)
      for (let i = 0; i < chunk.length; i++) out[i] = shape(chunk[i])
      return out
    },
    flush() { return new Float32Array(0) }
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
