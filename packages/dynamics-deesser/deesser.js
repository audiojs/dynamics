import { bandpass, lowpass, peaking, step, state } from '@audio/biquad'
import { compressorGain } from '@audio/dynamics-compressor'
import { writer, concat, db2lin, timeCoef, smoother } from './util.js'

// De-esser. An 's' is told by its shape, not its level: the sibilance band (a bandpass at `fc`, `Q`) over the voice
// body (a low-pass an octave under `fc`), in dB. The dbx 902 detects this way, "comparing (in dB) the high frequency
// level of an audio signal and the full bandwidth level", which "makes it possible to achieve the exact amount of
// de-essing desired regardless of variations in signal levels" (902 owner's manual, 1996). A threshold on the band's
// own level dulls a loud take, misses a quiet one and fires on any bright sound; a cymbal in a mix sits over the
// mix's body, not over nothing, and passes. The body's reference never sinks more than 30 dB under the voice's running
// level, so hiss in a pause is not taken for an 's' (the Oxford SuprEsser's level tracking likewise leaves out what
// falls under its 24 dB window; user guide §3.3.2). How far that difference rises over `threshold` drives a soft-knee
// gain computer (Giannoulis, Massberg & Reiss 2012, eq. 4) whose cut is held within `range`, the Range of the 902, of
// FabFilter Pro-DS and of Waves Sibilance: past it an 's' is "swallowed" (dbx), a lisp. The cut is smoothed in dB by
// the smooth decoupled peak detector (ibid. eq. 17), as the compressor's is. Two ways to apply it, by `mode`:
//  - broadband (default): the whole sound is turned down while the 's' lasts (Pro-DS "Wide Band");
//  - band: a peaking EQ at `fc`, `Q` cuts only the sibilance band (Pro-DS "Split Band").
export default function deesser(data, opts) {
  if (!(data instanceof Float32Array)) return writer(deesserStream(data))
  let s = deesserStream(opts)
  return concat(s.write(data), s.flush())
}

export function deesserStream(opts = {}) {
  let sr = opts.sampleRate || 44100, band = opts.mode === 'band'
  let fc = Math.min(opts.fc ?? opts.freq ?? 6500, 0.45 * sr)   // `freq`, `q`: former names
  let Q = opts.Q ?? opts.q ?? (band ? 1.4 : 2)
  let threshold = opts.threshold ?? 0, ratio = opts.ratio ?? 4, knee = opts.knee ?? 6, range = Math.abs(opts.range ?? -6)
  let ess = sibilance(fc, Q, sr), smooth = smoother(opts.attack ?? 1, opts.release ?? 15, sr)
  let cut = x => smooth(Math.min(range, -compressorGain(ess(x), threshold, ratio, knee)))   // dB, ≥ 0
  // band: the EQ's gain follows the cut, its coefficients set every `block` samples on the stream's own clock, so
  // any chunking gives the same samples
  let block = opts.block ?? 64, eq = state(), n = 0, eqc

  return {
    write(chunk) {
      let out = new Float32Array(chunk.length)
      for (let i = 0; i < chunk.length; i++) {
        let x = chunk[i], g = cut(x)
        if (!band) { out[i] = x * db2lin(-g); continue }
        if (n === 0) eqc = peaking(fc, Q, sr, -g)
        n = (n + 1) % block
        out[i] = step(eqc, eq, x)
      }
      return out
    },
    flush() { return new Float32Array(0) }
  }
}

// The sibilance band's power over the voice body's, dB, per sample. Each is a 5 ms mean square (the 902 senses RMS).
// The body's reference is floored 30 dB under the voice's running level (rising in 10 ms, falling in 1 s); under
// −100 dBFS nothing is an 's', so silence reads −200 dB. The ratio is smoothed over 1 ms in dB: filters starting from
// rest, and clicks, read high for a few samples; an 's' lasts tens of milliseconds.
function sibilance(fc, Q, sr) {
  let bp = bandpass(fc, Q, sr), lp = lowpass(fc / 2, Math.SQRT1_2, sr), sb = state(), sl = state()
  let a = timeCoef(5, sr), up = timeCoef(10, sr), down = timeCoef(1000, sr), d = timeCoef(1, sr)
  let ps = 0, pb = 0, pv = 0, r = -200
  return x => {
    let s = step(bp, sb, x), b = step(lp, sl, x)
    ps = a * ps + (1 - a) * s * s
    pb = a * pb + (1 - a) * b * b
    let c = pb > pv ? up : down
    pv = c * pv + (1 - c) * pb
    return r = d * r + (1 - d) * 10 * Math.log10((ps + 1e-30) / (Math.max(pb, 1e-3 * pv) + 1e-10))
  }
}
