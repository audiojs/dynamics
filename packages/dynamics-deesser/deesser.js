import { envelope } from '@audio/dynamics-envelope'
import { bandpass, highpass, peaking, step, state, process as biquad } from '@audio/biquad'
import { compressorGain } from '@audio/dynamics-compressor'
import { writer, concat, db2lin, lin2db } from './util.js'

// De-esser — two canonical architectures behind one entry, picked by `mode`:
//  - broadband (default): bandpass sidechain (sibilance band) drives a
//    compressor whose gain reduction is applied broadband — simple, transparent.
//  - band: HP-filtered sidechain drives a dynamic peaking EQ at `freq` — only
//    the sibilance band is cut, so program below the band stays untouched even
//    during deep reduction (wideband/split-band precedent).
export default function deesser(data, opts) {
  if (!(data instanceof Float32Array)) return writer(deesserStream(data))
  let s = deesserStream(opts)
  return concat(s.write(data), s.flush())
}

export function deesserStream(opts = {}) {
  return (opts.mode ?? 'broadband') === 'band' ? bandStream(opts) : broadbandStream(opts)
}

function broadbandStream(opts = {}) {
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

// Dynamic peaking-EQ de-esser: detection runs on an HP copy (above `freq`);
// when the envelope exceeds threshold, a negative peaking gain at `freq`
// engages on the audio path. EQ gain follows the envelope continuously —
// recomputed every `block` samples for smoothness without per-sample coef
// cost. Unlike a static shelf, the cut only engages on loud 's' / 'sh'
// events, so dark consonants aren't thinned.
function bandStream(opts = {}) {
  let sr = opts.sampleRate || 44100
  let freq = opts.freq ?? 6500
  let q = opts.q ?? 1.4
  let threshold = opts.threshold ?? -20
  let ratio = opts.ratio ?? 4
  let attackMs = opts.attack ?? 1
  let releaseMs = opts.release ?? 40
  let block = opts.block ?? 64

  let scC = highpass(freq, 0.707, sr)
  let scS = state()
  let eqS = state()
  let aA = Math.exp(-1 / (attackMs * 0.001 * sr))
  let aR = Math.exp(-1 / (releaseMs * 0.001 * sr))
  // EQ-gain smoothing runs once per block, so its coefficients are per-block:
  // deepening the cut follows `attack`, recovering follows `release`.
  let aBlkA = Math.exp(-block / (attackMs * 0.001 * sr))
  let aBlkR = Math.exp(-block / (releaseMs * 0.001 * sr))
  let thLin = db2lin(threshold)
  let env = 0, eqDb = 0

  return {
    write(chunk) {
      let out = new Float32Array(chunk.length)
      out.set(chunk)
      let sc = new Float32Array(chunk.length)
      sc.set(chunk)
      biquad(sc, scC, scS)
      for (let pos = 0; pos < out.length; pos += block) {
        let end = Math.min(out.length, pos + block)
        // update envelope across block, take peak
        let peakEnv = env
        for (let i = pos; i < end; i++) {
          let x = Math.abs(sc[i])
          env = x > env ? aA * env + (1 - aA) * x : aR * env + (1 - aR) * x
          if (env > peakEnv) peakEnv = env
        }
        let target = 0
        if (peakEnv > thLin) target = -lin2db(peakEnv / thLin) * (1 - 1 / ratio)  // negative dB cut
        eqDb = target < eqDb ? aBlkA * eqDb + (1 - aBlkA) * target : aBlkR * eqDb + (1 - aBlkR) * target
        biquad(out.subarray(pos, end), peaking(freq, q, sr, eqDb), eqS)
      }
      return out
    },
    flush() { return new Float32Array(0) }
  }
}
