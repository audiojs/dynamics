import { writer, concat, db2lin, timeCoef } from './util.js'

// Lookahead brickwall limiter. Each sample needs the gain r = min(1, ceiling/|x|); the sliding minimum of r
// over the lookahead span (monotonic deque) is the gain every sample in transit needs, and its moving average
// over the same span ramps into each peak across the lookahead instead of stepping at once: every value the
// average spans covers the sample being emitted, so the ramp never lets it past the ceiling (the design of
// the true-peak ceiling in audio's normalize). Exponential release after the peak passes.
//
// `truePeak` holds the reconstructed signal under the ceiling, not only its samples (ITU-R BS.1770-4 Annex 2:
// a DAC or a lossy decoder rebuilds the waveform between them, up to 3 dB over the samples). Each interval
// between samples is read at 8 points by a 96-tap Kaiser-windowed sinc (β 8), every local maximum refined by
// the parabola through it and its neighbours: full-band noise limited 20 dB peaks, band-limited, within 0.005 dB
// of the ceiling at 8-48 kHz (read at the Annex's 4 points, 0.03), given 16 samples of lookahead or more (fewer
// ramp the gain faster than the waveform between samples follows: 0.03). A sample's gain covers the intervals on both
// sides; the sliding minimum is widened by the kernel's reach each side, so an interpolant reads all its taps at
// one gain. Output is delayed 48 + lookahead + 48 samples.
const HALF = 48, TAPS = 2 * HALF, BETA = 8, POINTS = 8
const sinc = x => x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x)
const i0 = x => { let s = 1, t = 1; for (let k = 1; k < 50; k++) s += t *= (x / 2 / k) ** 2; return s }
const TPF = Array.from({ length: POINTS - 1 }, (_, i) => (i + 1) / POINTS).map(f => {
  let h = new Float64Array(TAPS), w = 0            // h[j] weighs x[n − j]
  for (let j = 0; j < TAPS; j++) { let x = HALF - j - f; w += h[j] = sinc(x) * i0(BETA * Math.sqrt(1 - (x / HALF) ** 2)) / i0(BETA) }
  return h.map(v => v / w)
})
// |y| ≤ S·max|x| over the taps (a parabola's vertex ≤ 9/8 of its peak point): below ceiling/S nothing
// can reach the ceiling, and the interpolation is skipped
const S = 9 / 8 * Math.max(...TPF.map(h => h.reduce((s, v) => s + Math.abs(v), 0)))
/** Vertex of the parabola through equally spaced l, m, r when m is their maximum, else m. */
const vertex = (l, m, r) => { let c = 2 * m - l - r; return m >= l && m >= r && c > 0 ? m + (l - r) * (l - r) / (8 * c) : m }

export default function limiter(data, opts) {
  if (!(data instanceof Float32Array)) return writer(limiterStream(data))
  let s = limiterStream(opts)
  return concat(s.write(data), s.flush())
}

/** Samples the output trails the input by. */
export function latency(opts = {}) {
  let la = Math.max(1, Math.round((opts.lookahead ?? 5) * 0.001 * (opts.sampleRate || 44100)))
  return opts.truePeak ? la + TAPS : la
}

export function limiterStream(opts = {}) {
  let sr = opts.sampleRate || 44100
  let ceiling = opts.ceiling ?? -0.3
  let lookahead = opts.lookahead ?? 5
  let releaseMs = opts.release ?? 50
  let tp = !!opts.truePeak

  let ceilLin = db2lin(ceiling)
  let laSamp = Math.max(1, Math.round(lookahead * 0.001 * sr))
  let rCoef = timeCoef(releaseMs, sr)
  let half = tp ? HALF : 0            // the kernel's reach either side of a sample
  let D = laSamp + 2 * half           // delay: the kernel's centre, the lookahead, its reach after

  let buf = new Float32Array(D)       // delay line
  let bi = 0
  let pending = 0                     // samples buffered but not yet emitted
  let env = 1

  // Monotonic deque: min required gain over the window [m - laSamp - 2·half, m]:
  // the emitted sample and its kernel's reach, through the newest gain known (m = n - half).
  let win = laSamp + 1, Q = win + 2 * half
  let qv = new Float64Array(Q)
  let qn = new Float64Array(Q)        // absolute sample index per entry
  let qh = 0, qt = 0                  // head/tail counters, slots taken mod Q
  // its moving average over the lookahead
  let avg = new Float64Array(win).fill(1), sum = win, ai = 0
  let n = 0

  // true peak: the last TAPS samples twice over (h[k..k+TAPS) contiguous), when they last ran hot
  let h = tp && new Float64Array(2 * TAPS), hi = 0
  let cold = ceilLin / S, hot = -1, last = 0, rPrev = 1

  // The gain sample m = n − HALF needs: x[m] and the intervals either side read between.
  function need(x) {
    h[hi] = h[hi + TAPS] = x
    hi = (hi + 1) % TAPS
    if ((x < 0 ? -x : x) > cold) hot = n + TAPS
    let o = hi + TAPS - 1                                       // h[o - k] is x[n − k]
    let a = h[o - HALF], b = h[o - HALF + 1]                    // x[m], x[m + 1]
    a = a < 0 ? -a : a; b = b < 0 ? -b : b
    let pk = a > b ? a : b
    if (n > hot) last = 0
    else {
      // the points a, ⅛ … ⅞, b in time order, each local maximum refined by its parabola
      let l = last, q = a
      for (let p = 0; p < TPF.length; p++) {
        // four running sums: independent adds pipeline
        let f = TPF[p], y0 = 0, y1 = 0, y2 = 0, y3 = 0
        for (let k = 0; k < TAPS; k += 4) { y0 += f[k] * h[o - k]; y1 += f[k + 1] * h[o - k - 1]; y2 += f[k + 2] * h[o - k - 2]; y3 += f[k + 3] * h[o - k - 3] }
        let y = y0 + y1 + y2 + y3
        if (y < 0) y = -y
        let v = vertex(l, q, y)
        if (v > pk) pk = v
        l = q; q = y
      }
      let v = vertex(l, q, b)
      if (v > pk) pk = v
      last = q
    }
    // the interval after m is this one, the one before it the last call's
    let r = pk > ceilLin ? ceilLin / pk : 1, g = r < rPrev ? r : rPrev
    rPrev = r
    return g
  }

  // Advance one sample; returns the gain-scaled emitted sample, or undefined
  // while the delay line is still warming up.
  function step(x) {
    let r
    if (tp) r = need(x)
    else { let ax = x < 0 ? -x : x; r = ax > ceilLin ? ceilLin / ax : 1 }
    let m = n - half
    while (qt > qh && qv[(qt - 1) % Q] >= r) qt--
    qv[qt % Q] = r
    qn[qt % Q] = m
    qt++
    if (qn[qh % Q] < m - laSamp - 2 * half) qh++
    let mn = qv[qh % Q]
    sum += mn - avg[ai]; avg[ai] = mn; ai = (ai + 1) % win
    let g = sum / win
    env = g < env ? g : rCoef * env + (1 - rCoef) * g
    n++
    if (pending < D) {
      buf[bi] = x
      bi = (bi + 1) % D
      pending++
      return
    }
    let y = buf[bi] * env
    buf[bi] = x
    bi = (bi + 1) % D
    return y
  }

  return {
    write(chunk) {
      let out = new Float32Array(chunk.length)
      let o = 0
      for (let i = 0; i < chunk.length; i++) {
        let y = step(chunk[i])
        if (y !== undefined) out[o++] = y
      }
      return out.subarray(0, o)
    },
    flush() {
      let out = new Float32Array(pending)
      let o = 0
      while (o < out.length) {
        let y = step(0)
        if (y !== undefined) out[o++] = y
      }
      pending = 0
      return out
    }
  }
}
