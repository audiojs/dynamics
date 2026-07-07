import { writer, concat, db2lin, timeCoef } from './util.js'

// Lookahead brickwall limiter. A sliding-window maximum (monotonic deque) over
// the lookahead span drives the envelope, so the gain at emission accounts for
// every sample still in transit — the envelope can never release below a delayed
// peak. Instant attack when a peak enters the window (lookahead ms before it
// emerges), exponential release after it leaves.
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
  let env = 0

  // Monotonic deque: max |x| over the window [n - laSamp, n] —
  // the emitted sample through the current one, laSamp + 1 samples.
  let win = laSamp + 1
  let qv = new Float32Array(win)
  let qn = new Float64Array(win)      // absolute sample index per entry
  let qh = 0, qt = 0                  // head/tail counters, slots taken mod win
  let n = 0

  // Advance one sample; returns the gain-scaled emitted sample, or undefined
  // while the delay line is still warming up.
  function step(x) {
    let ax = x < 0 ? -x : x
    while (qt > qh && qv[(qt - 1) % win] <= ax) qt--
    qv[qt % win] = ax
    qn[qt % win] = n
    qt++
    if (qn[qh % win] < n - laSamp) qh++
    let m = qv[qh % win]
    env = rCoef * env + (1 - rCoef) * m
    if (m > env) env = m
    let gain = env > ceilLin ? ceilLin / env : 1
    n++
    if (pending < laSamp) {
      buf[bi] = x
      bi = (bi + 1) % laSamp
      pending++
      return
    }
    let y = buf[bi] * gain
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
