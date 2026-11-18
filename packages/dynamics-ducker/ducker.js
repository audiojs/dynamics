import { compressorGain } from '@audio/dynamics-compressor'
import { writer2, concat, db2lin, lin2db, timeCoef } from './util.js'

// External-sidechain compressor: main signal's gain is reduced in proportion
// to the level of a separate side signal (e.g. voice track ducking music).
export default function ducker(main, side, opts) {
  if (!(main instanceof Float32Array)) return writer2(duckerStream(main))
  let s = duckerStream(opts)
  return concat(s.write(main, side), s.flush())
}

export function duckerStream(opts = {}) {
  let threshold = opts.threshold ?? -30
  let ratio = opts.ratio ?? 4
  let knee = opts.knee ?? 6
  let range = opts.range ?? -24  // max reduction in dB
  // the follower on the side signal: peak or RMS
  let sr = opts.sampleRate ?? opts.fs ?? 44100, rms = (opts.detector || 'peak') === 'rms'
  let k = Float64Array.of(threshold, ratio, knee, range, timeCoef(opts.attack ?? 20, sr), timeCoef(opts.release ?? 300, sr), rms ? 1 : 0)
  let s = new Float64Array(3), ring = new Float32Array(rms ? Math.max(1, opts.rmsWindow || 256) : 0)

  return {
    write(main, side) {
      let n = Math.min(main.length, side.length)
      let out = new Float32Array(main.length)
      duckBlock(main, side, out, s, ring, k)
      for (let i = n; i < main.length; i++) out[i] = main[i]
      return out
    },
    flush() { return new Float32Array(0) }
  }
}

/** One block of one channel into `out` (which may be `x`) over as many samples as both `x` and `key` hold, allocating
 *  nothing: `x` turned down by `key`'s level. `s`, the state: Float64Array(3), the follower, the RMS window's sum and
 *  position; `ring`, the window's squares (Float32Array of its length). `k`, the settings: Float64Array(7), threshold,
 *  ratio, knee, range (dB, the most it turns down), the follower's attack and release coefficients, 1 for RMS (0: peak).
 *  `g`: the threshold, ratio, knee and range for each sample, as a host's ramp moves them (Float64Array, from 0, M, 2·M
 *  and 3·M); empty (the default), `k`'s. */
export function duckBlock(x, key, out, s, ring, k, g = NONE, M = 0) {
  let T = k[0], R = k[1], W = k[2], G = k[3], aa = k[4], ar = k[5], rms = k[6] === 1, n = ring.length, ramp = g.length > 0
  let env = s[0], sum = s[1], j = s[2] | 0
  for (let i = 0, len = Math.min(x.length, key.length); i < len; i++) {
    if (ramp) { T = g[i]; R = g[M + i]; W = g[2 * M + i]; G = g[3 * M + i] }
    let v = key[i], mag
    if (rms) {
      let sq = v * v
      sum += sq - ring[j]; ring[j] = sq; j = (j + 1) % n
      mag = Math.sqrt(Math.max(0, sum / n))
    } else mag = v < 0 ? -v : v
    let c = mag > env ? aa : ar
    env = c * env + (1 - c) * mag
    let rDb = compressorGain(lin2db(env), T, R, W)
    if (rDb < G) rDb = G
    out[i] = x[i] * db2lin(rDb)
  }
  s[0] = env; s[1] = sum; s[2] = j
  return out
}
const NONE = new Float64Array(0)
