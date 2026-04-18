import { envelope } from './envelope.js'
import { writer, concat, db2lin, timeCoef } from './util.js'

// Noise gate with hold-then-close logic and smoothed gain transitions.
// Envelope triggers open/close, `hold` ms keeps gate open after level drop to
// avoid chatter, attack/release smooth the gain trajectory.
export default function gate(data, opts) {
  if (!(data instanceof Float32Array)) return writer(gateStream(data))
  let s = gateStream(opts)
  return concat(s.write(data), s.flush())
}

export function gateStream(opts = {}) {
  let sr = opts.sampleRate || 44100
  let threshold = opts.threshold ?? -40
  let range = opts.range ?? -60
  let hold = opts.hold ?? 10
  let attackMs = opts.attack ?? 0.1
  let releaseMs = opts.release ?? 100

  // Fast envelope drives trigger; separate coefficients smooth the gate gain.
  let env = envelope({ sampleRate: sr, attack: 0.1, release: 5, detector: opts.detector })
  let thLin = db2lin(threshold)
  let closedLin = db2lin(range)
  let aa = timeCoef(attackMs, sr)
  let ar = timeCoef(releaseMs, sr)
  let holdSamp = Math.max(0, Math.round(hold * 0.001 * sr))

  let g = closedLin
  let held = 0

  return {
    write(chunk) {
      let out = new Float32Array(chunk.length)
      for (let i = 0; i < chunk.length; i++) {
        let x = chunk[i]
        let e = env(x)
        let target
        if (e > thLin) { held = holdSamp; target = 1 }
        else if (held > 0) { held--; target = 1 }
        else target = closedLin
        let c = target > g ? aa : ar
        g = c * g + (1 - c) * target
        out[i] = x * g
      }
      return out
    },
    flush() { return new Float32Array(0) }
  }
}
