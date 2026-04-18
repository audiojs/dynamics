import { writer, concat, db2lin, timeCoef } from './util.js'

// Lookahead brickwall limiter. Peak-hold envelope with exponential release;
// input delayed by `lookahead` ms so gain reduction lands before the peak.
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

  let buf = new Float32Array(laSamp)
  let bi = 0
  let env = 0
  let pending = 0  // samples buffered but not yet emitted

  return {
    write(chunk) {
      let out = new Float32Array(chunk.length)
      let o = 0
      for (let i = 0; i < chunk.length; i++) {
        let x = chunk[i]
        let ax = x < 0 ? -x : x
        // Peak-hold attack (instantaneous), exponential release.
        if (ax > env) env = ax
        else env = rCoef * env + (1 - rCoef) * ax
        let gain = env > ceilLin ? ceilLin / env : 1

        if (pending < laSamp) {
          buf[bi] = x
          bi = (bi + 1) % laSamp
          pending++
        } else {
          out[o++] = buf[bi] * gain
          buf[bi] = x
          bi = (bi + 1) % laSamp
        }
      }
      return out.subarray(0, o)
    },
    flush() {
      if (!pending) return new Float32Array(0)
      let out = new Float32Array(pending)
      for (let i = 0; i < pending; i++) {
        // Continue envelope release over the tail so trailing peaks still limit.
        let s = buf[bi]
        let ax = s < 0 ? -s : s
        if (ax > env) env = ax
        else env = rCoef * env + (1 - rCoef) * ax
        let gain = env > ceilLin ? ceilLin / env : 1
        out[i] = s * gain
        bi = (bi + 1) % laSamp
      }
      pending = 0
      return out
    }
  }
}
