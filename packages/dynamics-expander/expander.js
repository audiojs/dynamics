import { envelope } from '@audio/dynamics-envelope'
import { writer, concat, db2lin, lin2db } from './util.js'

// Downward expander (`mode: 'downward'`, default): reduces gain below threshold
// by (T-L)·(ratio-1) dB, clamped at `range` dB of max reduction. Softer than a gate.
//
// Upward expander (`mode: 'upward'`): the de-compression complement — raises
// gain ABOVE threshold instead, undoing over-squashed dynamics. Four-quadrant
// dynamics taxonomy (Giannoulis, Massberg & Reiss 2012, JAES 60(6); Izhaki,
// Mixing Audio): downward/upward compression + downward/upward expansion.
// Classical substrate for de-limiting: transient-aware upward expansion
// restores crest factor a brickwall limiter flattened.
export default function expander(data, opts) {
  if (!(data instanceof Float32Array)) return writer(expanderStream(data))
  let s = expanderStream(opts)
  return concat(s.write(data), s.flush())
}

export function expanderStream(opts = {}) {
  let mode = opts.mode ?? 'downward'
  let threshold = opts.threshold ?? -30
  let ratio = opts.ratio ?? 2
  let knee = opts.knee ?? 6
  // range's sign follows mode: downward is a max-reduction floor (negative),
  // upward is a max-lift ceiling (positive) — same shape as compressor's upRange.
  let range = opts.range ?? (mode === 'upward' ? 20 : -40)
  let gain = mode === 'upward' ? upwardExpanderGain : expanderGain
  let env = envelope(opts)

  return {
    write(chunk) {
      let out = new Float32Array(chunk.length)
      for (let i = 0; i < chunk.length; i++) {
        let x = chunk[i]
        let rDb = gain(lin2db(env(x)), threshold, ratio, knee, range)
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
    r = -(ratio - 1) * x * x / (2 * kneeDb)
  }
  return r < rangeDb ? rangeDb : r
}

// Soft-knee upward expansion curve — the above-threshold complement of
// expanderGain. Returns gain LIFT in dB (≥ 0), clamped to `rangeDb`. Same
// engagement topology as compressorGain (off below threshold, engaged above);
// positive instead of negative, (ratio-1) coefficient instead of (1-1/ratio)
// — expander ratios are "dB out per dB in" beyond threshold, compressor
// ratios are "dB in per dB out".
export function upwardExpanderGain(levelDb, threshold, ratio, kneeDb, rangeDb) {
  let d = levelDb - threshold
  let r
  if (d <= -kneeDb / 2) r = 0
  else if (d > kneeDb / 2) r = d * (ratio - 1)
  else {
    let x = d + kneeDb / 2
    r = (ratio - 1) * x * x / (2 * kneeDb)
  }
  return r > rangeDb ? rangeDb : r
}
