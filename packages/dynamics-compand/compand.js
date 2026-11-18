import { writer, concat, db2lin, lin2db, timeCoef } from './util.js'

// Multi-segment compander (SoX `compand`). Arbitrary piecewise-linear transfer
// in dB. A single curve unifies compression, expansion and gating: points below
// the identity line reduce loud parts; points above raise quiet parts.
export default function compand(data, opts) {
  if (!(data instanceof Float32Array)) return writer(compandStream(data))
  let s = compandStream(opts)
  return concat(s.write(data), s.flush())
}

export function compandStream(opts = {}) {
  // Points: [[inDb, outDb], ...]. Default = mild compression above -20 dB.
  let points = (opts.points || [[-90, -90], [-60, -60], [-20, -20], [0, -8]])
    .slice().sort((a, b) => a[0] - b[0])
  if (!points.length) throw new RangeError('compand: points holds no [inDb, outDb] pair')
  // the follower: peak or RMS, attack and release
  let sr = opts.sampleRate ?? opts.fs ?? 44100, rms = (opts.detector || 'peak') === 'rms'
  let k = Float64Array.of(timeCoef(opts.attack ?? 5, sr), timeCoef(opts.release ?? 200, sr), rms ? 1 : 0)
  let s = new Float64Array(3), ring = new Float32Array(rms ? Math.max(1, opts.rmsWindow || 256) : 0), p = Float64Array.from(points.flatMap(q => [q[0], q[1]]))

  return {
    write(chunk) { return compandBlock(chunk, new Float32Array(chunk.length), s, ring, k, p) },
    flush() { return new Float32Array(0) }
  }
}

/** One block of one channel into `out` (which may be `x`), allocating nothing. `s`, the state: Float64Array(3), the
 *  follower, the RMS window's sum and position; `ring`, the window's squares (Float32Array of its length). `k`, the
 *  follower's settings: Float64Array(3), its attack and release coefficients, 1 for RMS (0: peak). `p`, the transfer
 *  curve: Float64Array of inDb, outDb, ..., sorted by inDb. `g`: each point's outDb for each sample (Float64Array,
 *  point j's from j·M), written into `p` sample by sample, as a host's ramp moves them; empty (the default), `p`'s. */
export function compandBlock(x, out, s, ring, k, p, g = NONE, M = 0) {
  let aa = k[0], ar = k[1], rms = k[2] === 1, n = ring.length, env = s[0], sum = s[1], j = s[2] | 0, P = g.length > 0 ? p.length >> 1 : 0
  for (let i = 0; i < x.length; i++) {
    for (let q = 0; q < P; q++) p[2 * q + 1] = g[q * M + i]
    let v = x[i], mag
    if (rms) {
      let sq = v * v
      sum += sq - ring[j]; ring[j] = sq; j = (j + 1) % n
      mag = Math.sqrt(Math.max(0, sum / n))
    } else mag = v < 0 ? -v : v
    let c = mag > env ? aa : ar
    env = c * env + (1 - c) * mag
    let lvl = lin2db(env)
    out[i] = v * db2lin(transfer(p, lvl) - lvl)
  }
  s[0] = env; s[1] = sum; s[2] = j
  return out
}
const NONE = new Float64Array(0)

function transfer(p, x) {
  let e = p.length - 2
  if (x <= p[0]) return p[1] + (x - p[0])
  if (x >= p[e]) return p[e + 1] + (x - p[e])
  for (let i = 2; i <= e; i += 2) {
    if (x <= p[i]) {
      let t = (x - p[i - 2]) / (p[i] - p[i - 2])
      return p[i - 1] + t * (p[i + 1] - p[i - 1])
    }
  }
  return x
}
