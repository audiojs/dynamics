import { compressorGain } from '@audio/dynamics-compressor'
import { writer, db2lin, timeCoef } from './util.js'

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

/** Seconds the output goes on after the input stops, past the delay: the linear-phase band's half-length, the farthest
 *  ahead of the delayed sample its taps read (none broadband, which only turns the delayed input down) */
export const tail = (sampleRate = 44100, mode = 'split') => mode === 'broadband' ? 0 : Math.round(HALF * sampleRate) / sampleRate

export default function deesser(data, opts) {
  if (!ArrayBuffer.isView(data)) return writer(deesserStream(data))
  let s = deesserStream(opts), n = data.length, L = s.latency, a = s.write(data), b = s.flush(), out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = i + L < n ? a[i + L] : b[i + L - n]
  return out
}

export function deesserStream(opts = {}) {
  let sr = opts.sampleRate || 44100, L = latency(sr, opts.lookahead ?? 5), set = deesserSet(sr), k = set.k
  k[0] = opts.threshold ?? 0; k[1] = opts.ratio ?? 4; k[2] = opts.knee ?? 6; k[3] = Math.abs(opts.range ?? -8)
  k[4] = timeCoef(opts.attack ?? 1, sr); k[5] = timeCoef(opts.release ?? 15, sr)
  deesserBand(set, opts.mode ?? 'split', Float64Array.of(opts.split ?? 3500, opts.fc ?? opts.freq ?? 6500, opts.Q ?? opts.q ?? 1.4))
  let s = deesserState(), buf = new Float64Array(L + (set.h.length >> 1) + 1)
  return {
    latency: L,
    write(chunk) { return deessBlock(chunk, new Float32Array(chunk.length), s, buf, set) },
    flush() { let out = new Float32Array(L); return deessBlock(out, out, s, buf, set) }
  }
}

// The settings, `set.k` (Float64Array): threshold, ratio, knee, range (dB, ≥ 0), the smoother's attack and release
// coefficients; 1 broadband; the sibilance band's two high-pass sections and the body's low-pass, b0 b1 b2 a1 a2 each;
// the detector's 5 ms mean square, its reference's rise (10 ms) and fall (1 s), the ratio's 1 ms smoothing; then what the
// band is tuned from: the sample rate, the mode (0 split, 1 band, 2 broadband), split, fc, Q; the band's edges lo, hi
// it was last tuned to and the body's top, min(BODY, lo). `set.h`, the linear-phase band (2M + 1 taps); `set.win`, its Kaiser window; `set.th`, scratch.
const MODE = 27, SPLIT = 28, FC = 29, QS = 30

/** The settings of one de-esser at a rate, for deesserBand and deessBlock: the band untuned, the window made. */
export function deesserSet(sampleRate) {
  let M = Math.round(HALF * sampleRate), k = new Float64Array(34), win = new Float64Array(2 * M + 1)
  for (let j = -M; j <= M; j++) win[j + M] = i0(6 * Math.sqrt(1 - (j / M) ** 2)) / i0(6)
  k[22] = timeCoef(5, sampleRate); k[23] = timeCoef(10, sampleRate); k[24] = timeCoef(1000, sampleRate); k[25] = timeCoef(1, sampleRate)
  k[26] = sampleRate; k[31] = k[32] = NaN
  return { k, h: new Float64Array(2 * M + 1), win, th: new Float64Array(2 * M + 1) }
}

/** One channel's state for deessBlock: the three biquad sections' (two each), the band's and the body's mean squares, the
 *  body's reference, the ratio in dB (−200: silence), the smoother's y₁ and y, the delay line's position. */
export const deesserState = () => Float64Array.of(0, 0, 0, 0, 0, 0, 0, 0, 0, -200, 0, 0, 0)

/** The band from `mode` ('split', 'band', 'broadband') and `band`, a Float64Array of split, fc and Q: the band and the
 *  detector's filters retuned, allocating nothing, when its edges move. (The numbers come in an array: a call V8 does not
 *  inline boxes the numbers passed to it.) */
export function deesserBand(set, mode, band) {
  let k = set.k
  k[MODE] = mode === 'band' ? 1 : mode === 'broadband' ? 2 : 0; k[SPLIT] = band[0]; k[FC] = band[1]; k[QS] = band[2]
  deesserTune(set)
}

// The band cut: over `split`, or `fc` ± half its bandwidth in octaves (RBJ: BW = 2·asinh(1/2Q)/ln 2)
function deesserTune(set) {
  let k = set.k, sr = k[26], mode = k[MODE], top = 0.45 * sr
  let fc = Math.min(k[FC], top), split = Math.min(k[SPLIT], top), bw = 2 * Math.asinh(1 / (2 * k[QS])) / Math.LN2
  let lo = mode === 1 ? fc * 2 ** (-bw / 2) : split, hi = mode === 1 ? Math.min(top, fc * 2 ** (bw / 2)) : top
  k[6] = mode === 2 ? 1 : 0
  if (lo === k[31] && hi === k[32]) return
  k[31] = lo; k[32] = hi; k[33] = Math.min(BODY, lo)
  rbj(k, 7, 31, 0.5412, true); rbj(k, 12, 31, 1.3066, true); rbj(k, 17, 33, Math.SQRT1_2, false)
  band(set)
}

/** One block of one channel into `out` (which may be `x`), `latency` samples late, allocating nothing; returns `out`.
 *  `s`, the state (deesserState); `buf`, the delay line, Float64Array(latency + M + 1) (2M + 1 the band's taps); `set`,
 *  deesserSet's, its band set (deesserBand). */
export function deessBlock(x, out, s, buf, set) {
  let k = set.k, h = set.h, M = h.length >> 1, R = buf.length, L = R - M - 1
  let threshold = k[0], ratio = k[1], knee = k[2], range = k[3], aA = k[4], aR = k[5], broad = k[6] === 1
  let b10 = k[7], b11 = k[8], b12 = k[9], a11 = k[10], a12 = k[11], b20 = k[12], b21 = k[13], b22 = k[14], a21 = k[15], a22 = k[16]
  let c0 = k[17], c1 = k[18], c2 = k[19], d1 = k[20], d2 = k[21], a = k[22], up = k[23], down = k[24], d = k[25]
  let z10 = s[0], z11 = s[1], z20 = s[2], z21 = s[3], zl0 = s[4], zl1 = s[5], ps = s[6], pb = s[7], pv = s[8], r = s[9]
  let y1 = s[10], y = s[11], bi = s[12] | 0
  for (let i = 0; i < x.length; i++) {
    let v = x[i]
    // sibilance: the band over lo (two high-pass sections, transposed direct form II) and the body under it
    let t = b10 * v + z10
    z10 = b11 * v - a11 * t + z11
    z11 = b12 * v - a12 * t
    let e = b20 * t + z20
    z20 = b21 * t - a21 * e + z21
    z21 = b22 * t - a22 * e
    let b = c0 * v + zl0
    zl0 = c1 * v - d1 * b + zl1
    zl1 = c2 * v - d2 * b
    ps = a * ps + (1 - a) * e * e
    pb = a * pb + (1 - a) * b * b
    let c = pb > pv ? up : down
    pv = c * pv + (1 - c) * pb
    r = d * r + (1 - d) * 10 * Math.log10((ps + 1e-30) / (Math.max(pb, 1e-3 * pv) + 1e-10))
    // the cut, dB ≥ 0, smoothed by the smooth decoupled peak detector
    let g = Math.min(range, -compressorGain(r, threshold, ratio, knee)), q = aR * y1 + (1 - aR) * g
    y1 = g > q ? g : q
    let cut = y = aA * y + (1 - aA) * y1
    buf[bi] = v
    let at = bi - L < 0 ? bi - L + R : bi - L, w = buf[at]                               // the input L samples back
    if (++bi === R) bi = 0
    if (broad) { out[i] = w * db2lin(-cut); continue }
    if (cut < 1e-4) { out[i] = w; continue }
    let acc = h[M] * w
    for (let j = 1, p = at, n = at; j <= M; j++) { if (++p === R) p = 0; if (--n < 0) n = R - 1; acc += h[M + j] * (buf[p] + buf[n]) }
    out[i] = w - (1 - db2lin(-cut)) * acc
  }
  s[0] = z10; s[1] = z11; s[2] = z20; s[3] = z21; s[4] = zl0; s[5] = zl1; s[6] = ps; s[7] = pb; s[8] = pv; s[9] = r
  s[10] = y1; s[11] = y; s[12] = bi
  return out
}

// The sibilance band's power (over `lo`, 4th-order Butterworth) over the voice body's (under `body`), dB, per sample.
// Each is a 5 ms mean square (the 902 senses RMS). The body's reference is floored 30 dB under the voice's running
// level (rising in 10 ms, falling in 1 s); under −100 dBFS nothing is an 's', so silence reads −200 dB. The ratio is
// smoothed over 1 ms in dB: filters starting from rest, and clicks, read high for a few samples; an 's' lasts tens of
// milliseconds. (deessBlock runs it; its sections are tuned here.)

// RBJ cookbook high- or low-pass section at fc = k[f], Q into k from o: b0, b1, b2, a1, a2 over a0 (Bristow-Johnson, "Audio
// EQ Cookbook"), each the expression @audio/biquad's highpass and lowpass evaluate, so the same numbers, made in place.
// Its numbers are read from k, not passed: a call V8 does not inline would box them
function rbj(k, o, f, Q, high) {
  let fc = k[f], sr = k[26], w = Math.PI * 2 * fc / sr, cw = Math.cos(w), alpha = Math.sin(w) / (2 * Q), a0 = 1 + alpha, e = high ? 1 + cw : 1 - cw
  k[o] = e / 2 / a0; k[o + 1] = (high ? -e : e) / a0; k[o + 2] = e / 2 / a0; k[o + 3] = -2 * cw / a0; k[o + 4] = (1 - alpha) / a0
}

// Linear-phase band [lo, hi] (hi at 0.45·sr: a high-pass), 2M + 1 taps into set.h: the difference of two Kaiser-windowed
// sincs (β 6, sidelobes ~ −44 dB), the low edge's own DC gain taken out so the band passes nothing at DC
function band(set) {
  let k = set.k, lo = k[31], hi = k[32], sr = k[26], h = set.h, win = set.win, th = set.th, M = h.length >> 1, top = hi >= 0.45 * sr, sl = 0, sh = 0
  for (let j = -M; j <= M; j++) {
    let l = sinc(lo, j, sr) * win[j + M], u = top ? 0 : sinc(hi, j, sr) * win[j + M]
    h[j + M] = l; th[j + M] = u; sl += l; sh += u
  }
  for (let j = -M; j <= M; j++) h[j + M] = (top ? (j ? 0 : 1) : th[j + M] / sh) - h[j + M] / sl
}
const sinc = (f, k, sr) => k ? Math.sin(2 * Math.PI * f / sr * k) / (Math.PI * k) : 2 * f / sr
const i0 = x => { let s = 1, t = 1; for (let k = 1; k < 32; k++) { t *= (x / 2 / k) ** 2; s += t } return s }
