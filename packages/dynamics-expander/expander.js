import { envelope } from '@audio/dynamics-envelope'
import { writer, concat, db2lin, lin2db } from '@audio/dynamics-core'

// Downward expander: reduces gain below threshold by (T-L)·(ratio-1) dB,
// clamped at `range` dB of max reduction. Softer than a gate.
export default function expander(data, opts) {
  if (!(data instanceof Float32Array)) return writer(expanderStream(data))
  let s = expanderStream(opts)
  return concat(s.write(data), s.flush())
}

export function expanderStream(opts = {}) {
  let threshold = opts.threshold ?? -30
  let ratio = opts.ratio ?? 2
  let knee = opts.knee ?? 6
  let range = opts.range ?? -40
  let env = envelope(opts)

  return {
    write(chunk) {
      let out = new Float32Array(chunk.length)
      for (let i = 0; i < chunk.length; i++) {
        let x = chunk[i]
        let rDb = expanderGain(lin2db(env(x)), threshold, ratio, knee, range)
        out[i] = x * db2lin(rDb)
      }
      return out
    },
    flush() { return new Float32Array(0) }
  }
}

// Soft-knee downward expansion curve. Returns gain reduction in dB (≤ 0).
export function expanderGain(levelDb, threshold, ratio, kneeDb, rangeDb) {
  let d = levelDb - threshold
  let r
  if (d > kneeDb / 2) r = 0
  else if (d <= -kneeDb / 2) r = d * (ratio - 1)
  else {
    let x = d - kneeDb / 2
    r = (ratio - 1) * x * x / (2 * kneeDb)
  }
  return r < rangeDb ? rangeDb : r
}
