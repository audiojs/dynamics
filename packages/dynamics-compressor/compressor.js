import { writer, concat, db2lin, lin2db, timeCoef } from './util.js'

// Feed-forward compressor as Giannoulis, Massberg & Reiss recommend (JAES 60(6), 2012, §5): the gain computer
// reads the level in dB, eq. (4), and its gain reduction is smoothed in the log domain after it, eq. (23), by
// the smooth decoupled peak detector, eq. (17). Attack and release are then the time constants, eq. (7), of the
// gain reduction itself at any level. A detector on the linear signal before the gain computer (their Fig. 7a,
// JUCE's dsp::Compressor) lags the attack while it charges up to the threshold and releases in a straight line
// in dB, longer the deeper the compression: 5 and 100 ms act as 2.8-10.6 and 22-146 ms from 3 to 20 dB over.
//
// Downward (above threshold, reduces gain) and upward (below threshold, adds gain) compression are the two
// halves of the four-quadrant dynamics taxonomy (Giannoulis et al. 2012; Izhaki, Mixing Audio): upward is the
// "OTT up" half. Both curves read the same level and sum in dB, one continuous transfer, smoothed as one.
export default function compressor(data, opts) {
  if (!(data instanceof Float32Array)) return writer(compressorStream(data))
  let s = compressorStream(opts)
  return concat(s.write(data), s.flush())
}

export function compressorStream(opts = {}) {
  let sr = opts.sampleRate ?? opts.fs ?? 44100
  let makeupDb = opts.makeup ?? 0
  let depth = opts.depth ?? 1
  // Upward compression is off by default (upThreshold: null skips its curve). upRatio defaults to 2 at this
  // (kernel) layer once enabled; the params-convention manifest defaults upRatio to 1 instead (a mathematical
  // no-op, see audio.js), since it has no null to switch on.
  let curve = {
    threshold: opts.threshold ?? -20, ratio: opts.ratio ?? 4, knee: opts.knee ?? 6,
    upThreshold: opts.upThreshold ?? null, upRatio: opts.upRatio ?? 2, upKnee: opts.upKnee ?? 6, upRange: opts.upRange ?? 12,
  }
  let st = compressorState(opts.attack ?? 5, opts.release ?? 100, sr, opts.detector, opts.rmsWindow)

  return {
    write(chunk) { return compress(chunk, new Float32Array(chunk.length), st, curve, depth, makeupDb) },
    flush() { return new Float32Array(0) }
  }
}

/** One channel's running state: the smoother's coefficients and poles, eq. (17), and the RMS window. */
export function compressorState(attack, release, sampleRate, type = 'peak', win = 256) {
  let rms = type === 'rms', n = rms ? Math.max(1, win) : 0
  return { aA: timeCoef(attack, sampleRate), aR: timeCoef(release, sampleRate), y1: 0, y: 0, rms, n, buf: new Float64Array(n), sum: 0, i: 0 }
}

/** Compress block `x` into `out` and return it: `detector`, `gainDb` and `smoother` as one loop over locals,
 *  the state carried in `s` from block to block. Gain 10^((−y·depth + makeup)/20). */
export function compress(x, out, s, c, depth = 1, makeup = 0) {
  // copied into compressBlock's typed form and back; SET and POLES are scratch: compressBlock calls nothing that comes here
  let set = SET, p = POLES, up = c.upThreshold != null
  set[0] = c.threshold; set[1] = c.ratio; set[2] = c.knee
  set[3] = up ? 1 : 0; set[4] = up ? c.upThreshold : 0; set[5] = c.upRatio; set[6] = c.upKnee; set[7] = c.upRange
  set[8] = depth; set[9] = makeup; set[10] = s.aA; set[11] = s.aR; set[12] = s.rms ? 1 : 0; set[13] = s.n
  p[0] = s.y1; p[1] = s.y; p[2] = s.sum; p[3] = s.i
  compressBlock(x, out, p, set, s.buf)
  s.y1 = p[0]; s.y = p[1]; s.sum = p[2]; s.i = p[3]
  return out
}
const SET = new Float64Array(14), POLES = new Float64Array(4)

/** `compress` on typed arrays, allocating nothing: `p`, one channel's state, Float64Array(4): the smoother's poles y₁
 *  and y, the RMS window's sum and position; `buf`, the window's squares (Float64Array, empty for peak). `set`, the
 *  settings, Float64Array(14): threshold, ratio, knee; 1 when upward compression is on (0: off), upThreshold, upRatio,
 *  upKnee, upRange; depth, makeup; the smoother's attack and release coefficients, eq. (7); 1 for RMS (0: peak), the
 *  window's length. Its two halves, compressLevel and compressGain, let a level come from elsewhere between them (a
 *  key, the loudest of linked channels). */
export function compressBlock(x, out, p, set, buf) {
  if (LEV.length < x.length) LEV = new Float64Array(x.length)
  compressLevel(x, LEV, p, set, buf)
  return compressGain(x, LEV, out, p, set)
}
let LEV = new Float64Array(0)

/** compressBlock's detector: the level of each sample of `x` into `lev` (Float64Array, as long or longer), |x| or the
 *  RMS window's mean square, linear. `p`, `set`, `buf` as compressBlock's (the window's sum and position change here). */
export function compressLevel(x, lev, p, set, buf) {
  let rms = set[12] === 1, n = set[13] | 0, sum = p[2], j = p[3] | 0
  for (let i = 0; i < x.length; i++) {
    let v = x[i]
    if (rms) {
      let sq = v * v
      sum += sq - buf[j]; buf[j] = sq; j = (j + 1) % n
      lev[i] = sum / n
    } else lev[i] = Math.abs(v)
  }
  p[2] = sum; p[3] = j
}

/** compressBlock's gain computer and smoother: `x` into `out` (which may be `x`), each sample by the gain of its level
 *  in `lev`, as compressLevel gives it. `p`, `set` as compressBlock's (the smoother's poles change here). `mk`: the
 *  makeup (dB) for each sample (Float64Array, as long or longer), as a host's ramp moves it; empty (the default),
 *  `set`'s. */
export function compressGain(x, lev, out, p, set, mk = NONE) {
  let T = set[0], R = set[1], K = set[2], up = set[3] === 1, uT = set[4], uR = set[5], uK = set[6], uG = set[7], depth = set[8], makeup = set[9]
  let aA = set[10], aR = set[11], rms = set[12] === 1, bA = 1 - aA, bR = 1 - aR, y1 = p[0], y = p[1], ramp = mk.length > 0
  // Level: |x| in dB, or the window's mean square in dB (10·log10), floored at −200 dB
  let floor = rms ? 1e-20 : 1e-10, k = (rms ? 10 : 20) / Math.LN10
  // Under T − K/2 the downward curve is exactly 0, over uT + uK/2 the upward one exactly its resting value (and
  // everywhere when upRatio is 1): between, the gain is known without the level, so the log is taken only off
  // this band. Its edges are compared in the linear level, set 1e-9 inside (~1e-8 dB), far over the log's
  // rounding, so a level in the band is one the dB comparison puts there too. Absurd thresholds (~1e3 dB, where
  // that rounding nears the margin) or NaN leave the band empty: every sample then takes the log.
  // (An empty band is hi = −1, not lo = Infinity: a constant Infinity among lo's values made V8 box lo once a block.)
  let hi = Math.abs(T) + Math.abs(K) < 1e3 ? Math.exp((T - K / 2) / k) * (1 - 1e-9) : -1
  if (!(hi > floor)) hi = -1
  let lo = -1
  if (up) {
    if (!(Math.abs(uT) + Math.abs(uK) < 1e3)) hi = -1
    else if (uR !== 1) lo = Math.exp((uT + uK / 2) / k) * (1 + 1e-9)
  }
  let g0 = 0
  if (hi > lo) {
    let db = k * Math.log(hi)
    g0 = compressorGain(db, T, R, K)
    if (up) g0 += upwardGain(db, uT, uR, uK, uG)
  }

  for (let i = 0; i < x.length; i++) {
    let v = x[i], l = lev[i], g = g0
    if (!(l > lo && l < hi)) {
      let db = k * Math.log(Math.max(l, floor))
      g = compressorGain(db, T, R, K)
      if (up) g += upwardGain(db, uT, uR, uK, uG)
    }
    // smoother(), eq. (17), on the reduction −g, inline
    let r = aR * y1 + bR * -g
    y1 = -g > r ? -g : r
    y = aA * y + bA * y1
    out[i] = v * db2lin(-y * depth + (ramp ? mk[i] : makeup))
  }
  p[0] = y1; p[1] = y
  return out
}
const NONE = new Float64Array(0)

/** Static gain, dB, at level `db`: the downward curve, plus the upward lift when `upThreshold` is set. */
export function gainDb(db, c) {
  let g = compressorGain(db, c.threshold, c.ratio, c.knee)
  return c.upThreshold == null ? g : g + upwardGain(db, c.upThreshold, c.upRatio, c.upKnee, c.upRange)
}

/** Level in dB per sample: the instantaneous peak |x|, or the RMS of the last `win` samples. */
export function detector(type = 'peak', win = 256) {
  if (type !== 'rms') return x => lin2db(x)
  let n = Math.max(1, win), buf = new Float64Array(n), sum = 0, i = 0
  return x => {
    let sq = x * x
    sum += sq - buf[i]; buf[i] = sq; i = (i + 1) % n
    return 10 / Math.LN10 * Math.log(Math.max(sum / n, 1e-20))
  }
}

/** Smooth decoupled peak detector, eq. (17), run on gain reduction in dB (> 0 reduces, < 0 lifts):
 *  y₁ = max(x, αR·y₁ + (1 − αR)·x), y = αA·y + (1 − αA)·y₁, α = e^(−1/(τ·fs)), eq. (7). */
export function smoother(attack, release, sampleRate) {
  let aA = timeCoef(attack, sampleRate), aR = timeCoef(release, sampleRate), y1 = 0, y = 0
  return x => {
    let r = aR * y1 + (1 - aR) * x
    y1 = x > r ? x : r
    return y = aA * y + (1 - aA) * y1
  }
}

// Soft-knee downward compression curve, eq. (4). Returns gain reduction in dB (≤ 0).
// Below (T - W/2): no compression. Above (T + W/2): full ratio. In knee: quadratic.
export function compressorGain(levelDb, threshold, ratio, kneeDb) {
  let d = levelDb - threshold
  if (d < -kneeDb / 2) return 0
  if (d >= kneeDb / 2) return -(d * (1 - 1 / ratio))
  let x = d + kneeDb / 2
  return -(1 - 1 / ratio) * x * x / (2 * kneeDb)
}

// Soft-knee upward compression curve — the below-threshold complement of
// compressorGain (four-quadrant taxonomy: downward compression engages above
// threshold, upward engages below). Returns gain LIFT in dB (≥ 0), clamped to
// `rangeDb` — essential, since without a ceiling silence would take unbounded
// gain. Knee is compressorGain's quadratic reflected about the threshold: off
// above (T + W/2), full ratio below (T - W/2), quadratic interpolation between.
export function upwardGain(levelDb, threshold, ratio, kneeDb, rangeDb = 12) {
  let d = levelDb - threshold
  let r
  if (d >= kneeDb / 2) r = 0
  else if (d <= -kneeDb / 2) r = -d * (1 - 1 / ratio)
  else {
    let x = kneeDb / 2 - d
    r = (1 - 1 / ratio) * x * x / (2 * kneeDb)
  }
  return r > rangeDb ? rangeDb : r
}
