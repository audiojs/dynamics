import { envelope } from '@audio/dynamics-envelope'
import { bandpass, step, state } from '@audio/biquad'
import { compressorGain } from '@audio/dynamics-compressor'
import { writer, concat, db2lin, lin2db } from './util.js'

// De-esser: bandpass sidechain (sibilance band) drives a compressor whose gain
// reduction is applied broadband — simple and transparent.
export default function deesser(data, opts) {
  if (!(data instanceof Float32Array)) return writer(deesserStream(data))
  let s = deesserStream(opts)
  return concat(s.write(data), s.flush())
}

export function deesserStream(opts = {}) {
  let sr = opts.sampleRate || 44100
  let freq = opts.freq ?? 6500
  let q = opts.q ?? 2
  let threshold = opts.threshold ?? -20
  let ratio = opts.ratio ?? 4
  let knee = opts.knee ?? 6

  let bp = bandpass(freq, q, sr)
  let bqState = state()
  let env = envelope({ sampleRate: sr, attack: opts.attack ?? 1, release: opts.release ?? 40, detector: opts.detector })

  return {
    write(chunk) {
      let out = new Float32Array(chunk.length)
      for (let i = 0; i < chunk.length; i++) {
        let x = chunk[i]
        let side = step(bp, bqState, x)
        let rDb = compressorGain(lin2db(env(side)), threshold, ratio, knee)
        out[i] = x * db2lin(rDb)
      }
      return out
    },
    flush() { return new Float32Array(0) }
  }
}
