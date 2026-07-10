import { envelope } from '@audio/dynamics-envelope'
import { writer, concat, db2lin, timeCoef } from './util.js'

// Noise gate with hysteresis, hold-then-close logic, look-ahead and smoothed
// gain transitions. The trigger envelope opens above `threshold` and, once
// open, only closes below `closeThreshold` (hysteresis prevents chatter near
// a single threshold); `hold` ms keeps the gate open after the level drops;
// attack/release smooth the gain trajectory. `lookahead` delays emission
// behind detection so the gate is already opening when a transient reaches
// the output — batch calls stay sample-aligned (write + flush covers the full
// signal, no silence prefix, no dropped tail); per-block hosts get the delay
// declared as latency (see audio.js).
export default function gate(data, opts) {
  if (!(data instanceof Float32Array)) return writer(gateStream(data))
  let s = gateStream(opts)
  return concat(s.write(data), s.flush())
}

export function gateStream(opts = {}) {
  let sr = opts.sampleRate || 44100
  let threshold = opts.threshold ?? -40
  let closeThreshold = Math.min(opts.closeThreshold ?? threshold - 6, threshold)
  let range = opts.range ?? -60
  let hold = opts.hold ?? 10
  let attackMs = opts.attack ?? 0.1
  let releaseMs = opts.release ?? 100
  let lookahead = opts.lookahead ?? 0

  // Fast envelope drives the trigger; separate coefficients smooth the gate gain.
  let env = envelope({ sampleRate: sr, attack: 0.1, release: 5, detector: opts.detector })
  let openLin = db2lin(threshold)
  let closeLin = db2lin(closeThreshold)
  let closedLin = db2lin(range)
  let aa = timeCoef(attackMs, sr)
  let ar = timeCoef(releaseMs, sr)
  let holdSamp = Math.max(0, Math.round(hold * 0.001 * sr))
  let laSamp = Math.max(0, Math.round(lookahead * 0.001 * sr))

  let g = closedLin
  let held = 0
  let open = false
  let buf = laSamp ? new Float32Array(laSamp) : null
  let bi = 0, pending = 0

  // Detection consumes the incoming sample; with look-ahead, emission returns a
  // sample laSamp behind it scaled by the *current* gain — the gate state at
  // emission already reflects material laSamp ahead, so attacks open in time.
  function step(x) {
    let e = env(x)
    let target
    if (e > openLin) { open = true; held = holdSamp; target = 1 }
    else if (held > 0) { held--; target = 1 }
    else if (open && e > closeLin) target = 1     // hysteresis band: stay open
    else { open = false; target = closedLin }
    let c = target > g ? aa : ar
    g = c * g + (1 - c) * target
    if (!laSamp) return x * g
    if (pending < laSamp) { buf[bi] = x; bi = (bi + 1) % laSamp; pending++; return }
    let y = buf[bi] * g
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
      return o === chunk.length ? out : out.subarray(0, o)
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
