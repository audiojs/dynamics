import { writer, concat, db2lin, timeCoef } from './util.js'

// Lookahead brickwall limiter. Each sample needs the gain r = min(1, ceiling/|x|); the sliding minimum of r
// over the lookahead span (monotonic deque) is the gain every sample in transit needs, and its moving average
// over the same span ramps into each peak across the lookahead instead of stepping at once: every value the
// average spans covers the sample being emitted, so the ramp never lets it past the ceiling (the design of
// the true-peak ceiling in audio's normalize). Exponential release after the peak passes.
export default function limiter(data, opts) {
  if (!(data instanceof Float32Array)) return writer(limiterStream(data))
  let s = limiterStream(opts)
  return concat(s.write(data), s.flush())
}

export function limiterStream(opts = {}) {
  let sr = opts.sampleRate || 44100
  let ceiling = opts.ceiling ?? -0.3
  let lookahead = opts.lookahead ?? 5
  let releaseMs = opts.release ?? 50

  let ceilLin = db2lin(ceiling)
  let laSamp = Math.max(1, Math.round(lookahead * 0.001 * sr))
  let rCoef = timeCoef(releaseMs, sr)

  let buf = new Float32Array(laSamp)  // delay line
  let bi = 0
  let pending = 0                     // samples buffered but not yet emitted
  let env = 1

  // Monotonic deque: min required gain over the window [n - laSamp, n]:
  // the emitted sample through the current one, laSamp + 1 samples.
  let win = laSamp + 1
  let qv = new Float64Array(win)
  let qn = new Float64Array(win)      // absolute sample index per entry
  let qh = 0, qt = 0                  // head/tail counters, slots taken mod win
  // its moving average over the same window
  let avg = new Float64Array(win).fill(1), sum = win, ai = 0
  let n = 0

  // Advance one sample; returns the gain-scaled emitted sample, or undefined
  // while the delay line is still warming up.
  function step(x) {
    let ax = x < 0 ? -x : x
    let r = ax > ceilLin ? ceilLin / ax : 1
    while (qt > qh && qv[(qt - 1) % win] >= r) qt--
    qv[qt % win] = r
    qn[qt % win] = n
    qt++
    if (qn[qh % win] < n - laSamp) qh++
    let m = qv[qh % win]
    sum += m - avg[ai]; avg[ai] = m; ai = (ai + 1) % win
    let g = sum / win
    env = g < env ? g : rCoef * env + (1 - rCoef) * g
    n++
    if (pending < laSamp) {
      buf[bi] = x
      bi = (bi + 1) % laSamp
      pending++
      return
    }
    let y = buf[bi] * env
    buf[bi] = x
    bi = (bi + 1) % laSamp
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
