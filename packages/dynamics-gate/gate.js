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

  // Fast envelope drives the trigger (0.1 ms attack, 5 ms release, peak or RMS);
  // separate coefficients smooth the gate gain.
  let rms = (opts.detector || 'peak') === 'rms'
  let k = Float64Array.of(db2lin(threshold), db2lin(closeThreshold), db2lin(range), timeCoef(attackMs, sr), timeCoef(releaseMs, sr),
    Math.max(0, Math.round(hold * 0.001 * sr)), timeCoef(0.1, sr), timeCoef(5, sr), rms ? 1 : 0)
  let laSamp = Math.max(0, Math.round(lookahead * 0.001 * sr))
  let s = gateState(k[2]), ring = new Float32Array(rms ? 256 : 0), buf = new Float32Array(laSamp)

  return {
    write(chunk) {
      let out = new Float32Array(chunk.length), skip = gateBlock(chunk, out, s, ring, buf, k)
      return skip ? out.subarray(skip) : out
    },
    // the `pending` samples still in the delay line: zeros through it until they are out
    flush() {
      let p = s[7]
      if (!p) return new Float32Array(0)
      let out = new Float32Array(laSamp)
      gateBlock(out, out, s, ring, buf, k)
      s[7] = 0
      return out.subarray(laSamp - p)
    }
  }
}

/** One channel's state for gateBlock, the gate closed at gain `closed` (linear): the trigger follower, the RMS window's
 *  sum and position, the gain, the hold left (samples), 1 while open, the delay line's position and how full it is. */
export const gateState = (closed) => Float64Array.of(0, 0, 0, closed, 0, 0, 0, 0)

/** One block of one channel into `out` (which may be `x`), allocating nothing. With a look-ahead, `out` lags `x` by the
 *  delay line's length; while the line first fills nothing comes out (0 there): returns how many samples that was.
 *  `s`, the state (gateState); `ring`, the RMS window's squares (Float32Array of its length, empty for peak); `buf`, the
 *  delay line (Float32Array of the look-ahead in samples, empty for none). `k`, the settings: Float64Array(9), the open,
 *  close and closed gains (linear), the gain's attack and release coefficients, the hold (samples), the trigger
 *  follower's attack and release coefficients, 1 for RMS (0: peak). */
export function gateBlock(x, out, s, ring, buf, k) {
  if (LEV.length < x.length) LEV = new Float64Array(x.length)
  gateLevel(x, LEV, s, ring, k)
  return gateGain(x, LEV, out, s, buf, k)
}
let LEV = new Float64Array(0)

/** gateBlock's trigger follower: its level after each sample of `x` into `lev` (Float64Array, as long or longer),
 *  linear. `s`, `ring`, `k` as gateBlock's (the follower and the RMS window change here). gateLevel then gateGain is
 *  gateBlock, with room between them for a level from elsewhere (a key, the loudest of linked channels). */
export function gateLevel(x, lev, s, ring, k) {
  let aE = k[6], rE = k[7], rms = k[8] === 1, n = ring.length
  let env = s[0], sum = s[1], j = s[2] | 0
  for (let i = 0; i < x.length; i++) {
    let v = x[i], mag
    if (rms) {
      let sq = v * v
      sum += sq - ring[j]; ring[j] = sq; j = (j + 1) % n
      mag = Math.sqrt(Math.max(0, sum / n))
    } else mag = v < 0 ? -v : v
    let c = mag > env ? aE : rE
    env = c * env + (1 - c) * mag
    lev[i] = env
  }
  s[0] = env; s[1] = sum; s[2] = j
}

/** gateBlock's gate: hysteresis, hold, the gain and the delay line, each sample of `x` into `out` (which may be `x`) by
 *  its trigger level in `lev`, as gateLevel gives it; returns the samples swallowed while the line first fills.
 *  `s`, `buf`, `k` as gateBlock's. `cl`: the closed gain (linear) for each sample (Float64Array, as long or longer), as a
 *  host's ramp of the range moves it; empty (the default), `k`'s. */
export function gateGain(x, lev, out, s, buf, k, cl = NONE) {
  let openLin = k[0], closeLin = k[1], closedLin = k[2], aa = k[3], ar = k[4], holdSamp = k[5], ramp = cl.length > 0
  let L = buf.length, skip = 0
  let g = s[3], held = s[4], open = s[5] === 1, bi = s[6] | 0, pending = s[7]
  // Detection consumes the incoming sample; with look-ahead, emission returns a
  // sample laSamp behind it scaled by the *current* gain — the gate state at
  // emission already reflects material laSamp ahead, so attacks open in time.
  for (let i = 0; i < x.length; i++) {
    let v = x[i], env = lev[i], c
    let target
    if (env > openLin) { open = true; held = holdSamp; target = 1 }
    else if (held > 0) { held--; target = 1 }
    else if (open && env > closeLin) target = 1     // hysteresis band: stay open
    else { open = false; target = ramp ? cl[i] : closedLin }
    c = target > g ? aa : ar
    g = c * g + (1 - c) * target
    if (!L) { out[i] = v * g; continue }
    if (pending < L) { buf[bi] = v; bi = (bi + 1) % L; pending++; out[i] = 0; skip++; continue }
    let y = buf[bi] * g
    buf[bi] = v
    bi = (bi + 1) % L
    out[i] = y
  }
  s[3] = g; s[4] = held; s[5] = open ? 1 : 0; s[6] = bi; s[7] = pending
  return skip
}
const NONE = new Float64Array(0)
