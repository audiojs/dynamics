import { writer, concat, db2lin, lin2db, timeCoef } from './util.js'

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
  // the follower: peak or RMS, attack 5 ms and release 50 by default
  let sr = opts.sampleRate ?? opts.fs ?? 44100, rms = (opts.detector || 'peak') === 'rms'
  let k = Float64Array.of(mode === 'upward' ? 1 : 0, threshold, ratio, knee, range, timeCoef(opts.attack ?? 5, sr), timeCoef(opts.release ?? 50, sr), rms ? 1 : 0)
  let s = new Float64Array(3), ring = new Float32Array(rms ? Math.max(1, opts.rmsWindow || 256) : 0)

  return {
    write(chunk) { return expandBlock(chunk, new Float32Array(chunk.length), s, ring, k) },
    flush() { return new Float32Array(0) }
  }
}

/** One block of one channel into `out` (which may be `x`), allocating nothing. `s`, the state: Float64Array(3), the
 *  follower, the RMS window's sum and position; `ring`, the window's squares (Float32Array of its length). `k`, the
 *  settings: Float64Array(8), 1 for upward (0: downward), threshold, ratio, knee, range (dB, signed as the curve
 *  takes it), the follower's attack and release coefficients, 1 for RMS (0: peak). Its two halves, expandLevel and
 *  expandGain, let a level come from elsewhere between them (a key, the loudest of linked channels). */
export function expandBlock(x, out, s, ring, k) {
  if (LEV.length < x.length) LEV = new Float64Array(x.length)
  expandLevel(x, LEV, s, ring, k)
  return expandGain(x, LEV, out, k)
}
let LEV = new Float64Array(0)

/** expandBlock's follower: its level after each sample of `x` into `lev` (Float64Array, as long or longer), linear.
 *  `s`, `ring`, `k` as expandBlock's. */
export function expandLevel(x, lev, s, ring, k) {
  let aa = k[5], ar = k[6], rms = k[7] === 1, n = ring.length
  let env = s[0], sum = s[1], j = s[2] | 0
  for (let i = 0; i < x.length; i++) {
    let v = x[i], mag
    if (rms) {
      let sq = v * v
      sum += sq - ring[j]; ring[j] = sq; j = (j + 1) % n
      mag = Math.sqrt(Math.max(0, sum / n))
    } else mag = v < 0 ? -v : v
    let c = mag > env ? aa : ar
    env = c * env + (1 - c) * mag
    lev[i] = env
  }
  s[0] = env; s[1] = sum; s[2] = j
}

/** expandBlock's gain: `x` into `out` (which may be `x`), each sample by the curve at its level in `lev`, as
 *  expandLevel gives it. `k` as expandBlock's. `g`: the threshold, ratio, knee and range for each sample, as a host's
 *  ramp moves them (Float64Array, from 0, M, 2·M and 3·M; the range a magnitude, signed here by `k`'s mode); empty
 *  (the default), `k`'s. */
export function expandGain(x, lev, out, k, g = NONE, M = 0) {
  let up = k[0] === 1, T = k[1], R = k[2], W = k[3], G = k[4], ramp = g.length > 0
  for (let i = 0; i < x.length; i++) {
    if (ramp) { T = g[i]; R = g[M + i]; W = g[2 * M + i]; G = up ? g[3 * M + i] : -g[3 * M + i] }
    out[i] = x[i] * db2lin(expansion(lin2db(lev[i]), T, R, W, G, up))
  }
  return out
}
const NONE = new Float64Array(0)

// Soft-knee downward expansion curve. Returns gain reduction in dB (≤ 0).
export function expanderGain(levelDb, threshold, ratio, kneeDb, rangeDb) {
  return expansion(levelDb, threshold, ratio, kneeDb, rangeDb, false)
}

// Soft-knee upward expansion curve — the above-threshold complement of
// expanderGain. Returns gain LIFT in dB (≥ 0), clamped to `rangeDb`. Same
// engagement topology as compressorGain (off below threshold, engaged above);
// positive instead of negative, (ratio-1) coefficient instead of (1-1/ratio)
// — expander ratios are "dB out per dB in" beyond threshold, compressor
// ratios are "dB in per dB out".
export function upwardExpanderGain(levelDb, threshold, ratio, kneeDb, rangeDb) {
  return expansion(levelDb, threshold, ratio, kneeDb, rangeDb, true)
}

// Both curves in one body, upward or downward, so expandBlock calls one function in either mode: V8 boxed the result
// of a choice between the two calls (a number allocated a sample) wherever one of them had not run yet.
function expansion(levelDb, threshold, ratio, kneeDb, rangeDb, up) {
  let d = levelDb - threshold
  let r
  if (up) {
    if (d <= -kneeDb / 2) r = 0
    else if (d > kneeDb / 2) r = d * (ratio - 1)
    else {
      let x = d + kneeDb / 2
      r = (ratio - 1) * x * x / (2 * kneeDb)
    }
    return r > rangeDb ? rangeDb : r
  }
  if (d > kneeDb / 2) r = 0
  else if (d <= -kneeDb / 2) r = d * (ratio - 1)
  else {
    let x = d - kneeDb / 2
    r = -(ratio - 1) * x * x / (2 * kneeDb)
  }
  return r < rangeDb ? rangeDb : r
}
