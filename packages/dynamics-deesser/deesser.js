import { lowpass, highpass, step, state } from '@audio/biquad'
import { compressorGain } from '@audio/dynamics-compressor'
import { writer, db2lin, timeCoef, smoother } from './util.js'

// De-esser. An 's' is told by its shape, not its level: the band where sibilance lies over the voice body (its
// formants, under 3.5 kHz), in dB. The dbx 902 detects this way, "comparing (in dB) the high frequency level of an
// audio signal and the full bandwidth level", which "makes it possible to achieve the exact amount of de-essing desired
// regardless of variations in signal levels" (902 owner's manual, 1996). A threshold on the band's own level dulls a
// loud take, misses a quiet one and fires on any bright sound; a cymbal in a mix sits over the mix's body, not over
// nothing, and passes. The body's reference never sinks more than 30 dB under the voice's running level, so hiss in a
// pause is not taken for an 's' (the Oxford SuprEsser's level tracking likewise leaves out what falls under its 24 dB
// window; user guide §3.3.2). How far that difference rises over `threshold` drives a soft-knee gain computer
// (Giannoulis, Massberg & Reiss 2012, eq. 4) whose cut is held within `range`, the Range of the 902, of FabFilter
// Pro-DS and of Waves Sibilance. The cut is smoothed in dB by the smooth decoupled peak detector (ibid. eq. 17).
// The sound is read `lookahead` ms ahead of what it cuts (declared latency): an 's' sets its own level within a few
// ms, and a cut that waits for it leaves its onset whole. Three ways to apply it, by `mode`:
//  - split (default): only the band over `split` moves, out = x − (1 − g)·HP(x), HP linear-phase (a Kaiser-windowed
//    sinc of ±1.5 ms), so x − HP is exactly the rest, delayed: no bump at the split, and at g = 1 the input itself;
//  - band: the same with a linear-phase band-pass an octave-ish wide at `fc` (its width set by `Q`, as a peaking EQ's);
//  - broadband: the whole sound is turned down while the 's' lasts (Pro-DS "Wide Band").
const BODY = 3500        // Hz, the voice body's top: F1–F3
const HALF = 0.0015      // s, the split's linear-phase half-length

/** The delay, samples: the look-ahead, and never under the split's half-length */
export const latency = (sampleRate = 44100, lookahead = 5) => Math.max(Math.round(lookahead * 0.001 * sampleRate), Math.round(HALF * sampleRate))

export default function deesser(data, opts) {
  if (!ArrayBuffer.isView(data)) return writer(deesserStream(data))
  let s = deesserStream(opts), n = data.length, L = s.latency, a = s.write(data), b = s.flush(), out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = i + L < n ? a[i + L] : b[i + L - n]
  return out
}

export function deesserStream(opts = {}) {
  let sr = opts.sampleRate || 44100, mode = opts.mode ?? 'split', top = 0.45 * sr
  let fc = Math.min(opts.fc ?? opts.freq ?? 6500, top), Q = opts.Q ?? opts.q ?? 1.4, split = Math.min(opts.split ?? 3500, top)
  // the band cut: over `split`, or `fc` ± half its bandwidth in octaves (RBJ: BW = 2·asinh(1/2Q)/ln 2)
  let bw = 2 * Math.asinh(1 / (2 * Q)) / Math.LN2, lo = mode === 'band' ? fc * 2 ** (-bw / 2) : split, hi = mode === 'band' ? Math.min(top, fc * 2 ** (bw / 2)) : top
  let threshold = opts.threshold ?? 0, ratio = opts.ratio ?? 4, knee = opts.knee ?? 6, range = Math.abs(opts.range ?? -8)
  let ess = sibilance(lo, Math.min(BODY, lo), sr), smooth = smoother(opts.attack ?? 1, opts.release ?? 15, sr)
  let L = latency(sr, opts.lookahead ?? 5), M = Math.round(HALF * sr), h = mode === 'broadband' ? null : band(lo, hi, M, sr)
  let R = L + M + 1, buf = new Float64Array(R), bi = 0

  function tick(x) {
    let cut = smooth(Math.min(range, -compressorGain(ess(x), threshold, ratio, knee)))   // dB, ≥ 0
    buf[bi] = x
    let at = bi - L < 0 ? bi - L + R : bi - L, y = buf[at]                               // the input L samples back
    if (++bi === R) bi = 0
    if (!h) return y * db2lin(-cut)
    if (cut < 1e-4) return y
    let acc = h[M] * y
    for (let k = 1, p = at, q = at; k <= M; k++) { if (++p === R) p = 0; if (--q < 0) q = R - 1; acc += h[M + k] * (buf[p] + buf[q]) }
    return y - (1 - db2lin(-cut)) * acc
  }
  return {
    latency: L,
    write(chunk) { let out = new Float32Array(chunk.length); for (let i = 0; i < chunk.length; i++) out[i] = tick(chunk[i]); return out },
    flush() { let out = new Float32Array(L); for (let i = 0; i < L; i++) out[i] = tick(0); return out }
  }
}

// The sibilance band's power (over `lo`, 4th-order Butterworth) over the voice body's (under `body`), dB, per sample.
// Each is a 5 ms mean square (the 902 senses RMS). The body's reference is floored 30 dB under the voice's running
// level (rising in 10 ms, falling in 1 s); under −100 dBFS nothing is an 's', so silence reads −200 dB. The ratio is
// smoothed over 1 ms in dB: filters starting from rest, and clicks, read high for a few samples; an 's' lasts tens of
// milliseconds.
function sibilance(lo, body, sr) {
  let h1 = highpass(lo, 0.5412, sr), h2 = highpass(lo, 1.3066, sr), lp = lowpass(body, Math.SQRT1_2, sr), s1 = state(), s2 = state(), sl = state()
  let a = timeCoef(5, sr), up = timeCoef(10, sr), down = timeCoef(1000, sr), d = timeCoef(1, sr)
  let ps = 0, pb = 0, pv = 0, r = -200
  return x => {
    let s = step(h2, s2, step(h1, s1, x)), b = step(lp, sl, x)
    ps = a * ps + (1 - a) * s * s
    pb = a * pb + (1 - a) * b * b
    let c = pb > pv ? up : down
    pv = c * pv + (1 - c) * pb
    return r = d * r + (1 - d) * 10 * Math.log10((ps + 1e-30) / (Math.max(pb, 1e-3 * pv) + 1e-10))
  }
}

// Linear-phase band [lo, hi] (hi at 0.45·sr: a high-pass), 2M + 1 taps: the difference of two Kaiser-windowed sincs
// (β 6, sidelobes ~ −44 dB), the low edge's own DC gain taken out so the band passes nothing at DC
function band(lo, hi, M, sr) {
  let h = new Float64Array(2 * M + 1), w = k => i0(6 * Math.sqrt(1 - (k / M) ** 2)) / i0(6), sinc = (f, k) => k ? Math.sin(2 * Math.PI * f / sr * k) / (Math.PI * k) : 2 * f / sr
  let top = hi >= 0.45 * sr, sl = 0, sh = 0
  for (let k = -M; k <= M; k++) sl += sinc(lo, k) * w(k), sh += top ? 0 : sinc(hi, k) * w(k)
  for (let k = -M; k <= M; k++) h[k + M] = (top ? (k ? 0 : 1) : sinc(hi, k) * w(k) / sh) - sinc(lo, k) * w(k) / sl
  return h
}
const i0 = x => { let s = 1, t = 1; for (let k = 1; k < 32; k++) { t *= (x / 2 / k) ** 2; s += t } return s }
