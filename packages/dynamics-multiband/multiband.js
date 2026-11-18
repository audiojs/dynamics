// Multiband compressor — Linkwitz-Riley band split + per-band soft-knee compression + flat sum.
// SoX mcompand / FFmpeg-class; the Music Enhancer / Auto-Chain mastering stage.
//
// The sum is flat by construction. A Linkwitz-Riley pair's low and high outputs add to an allpass, AP = LP + HP
// (Linkwitz & Riley 1976, JAES 24(1); @audio/eq-crossover sets the polarity that makes it so). Band b is the high-passes
// of the crossovers under it, its own low-pass, and the allpasses of the crossovers over it: summed from the top, the
// last two bands give HP·…·(LP + HP) = HP·…·AP, the band under them adds its LP to that HP, and so on down, so the N
// bands add to AP₁·AP₂·…·AP₍N−1₎: the input with its magnitude untouched and its phase turned, never the input sample
// for sample. Without the allpasses (the bands as eq-crossover splits them) three bands summed to LP₁ + HP₁·LP₂ + HP₂,
// 0.12 dB down at 1.5 kHz with crossovers at 200 and 2000 Hz, 2.5 dB down where they meet.
// A Linkwitz-Riley pair's allpass is one section per section of its Butterworth half, from that section's denominator:
// (a2 + a1·z⁻¹ + z⁻²) / (1 + a1·z⁻¹ + a2·z⁻²), or (a1 + z⁻¹) / (1 + a1·z⁻¹) for a first-order one. It is D(−s)/D(s)
// through the bilinear transform, which LP + HP of a Butterworth pair squared is.
//
// Each band's compressor is @audio/dynamics-compressor 0.2's: a branching one-pole follower (peak or RMS) on the band,
// its level in dB through the soft-knee curves, gain 10^((g·depth + makeup)/20), written out here on typed state.

import crossover from '@audio/eq-crossover'
import { compressorGain, upwardGain } from '@audio/dynamics-compressor'

/**
 * @param {Float32Array} data — mono PCM, processed in place
 * @param {object} opts
 * @param {number[]} [opts.freqs=[200,2000]] — crossover frequencies (N-1 for N bands)
 * @param {object|object[]} [opts.bands] — @audio/dynamics-compressor params per band
 *   ({threshold, ratio, knee, attack, release, makeup, upThreshold, upRatio, upKnee,
 *   upRange, depth} — upward compression and the OTT "Depth" macro included, read as
 *   @audio/dynamics-compressor 0.2's batch call reads them) or one object shared by all bands;
 *   omit a band's params (or pass null) to leave that band uncompressed
 * @param {number} [opts.order=4] — LR order (2, 4, 8)
 * @param {number} [opts.fs=44100]
 */
export default function multiband (data, opts) {
	data.set(multibandStream(opts).write(data))
	return data
}

/** The writer form: `write(chunk)` returns the chunk's bands summed (a new array), the crossovers' and the followers'
 *  state carried from chunk to chunk; `flush()` returns nothing more (there is no delay). */
export function multibandStream ({ freqs = [200, 2000], bands, order = 4, fs = 44100 } = {}) {
	let { co, at } = network(freqs, order, fs), nb = at.length - 1
	let set = new Float64Array(nb * BAND), bst = new Float64Array(nb * 3), rings = []
	for (let b = 0; b < nb; b++) rings.push(bandSet(set, b, Array.isArray(bands) ? bands[b] : bands, fs))
	let st = new Float64Array(2 * at[nb]), tmp = new Float32Array(0), acc = new Float64Array(0)
	return {
		write (chunk) {
			if (tmp.length < chunk.length) { tmp = new Float32Array(chunk.length); acc = new Float64Array(chunk.length) }
			return multibandBlock(chunk, new Float32Array(chunk.length), co, at, st, set, bst, rings, tmp, acc)
		},
		flush () { return new Float32Array(0) }
	}
}

/** Settings a band takes in multibandBlock's `set`, from b·BAND: 1 to compress (0: pass), threshold, ratio, knee,
 *  makeup, depth; 1 for the upward curve (0: off), upThreshold, upRatio, upKnee, upRange; the follower's attack and
 *  release coefficients; 1 for RMS (0: peak). */
export const BAND = 14

/** One block of one channel into `out` (which may be `x`), allocating nothing. `co`: the sections' coefficients, b0 b1
 *  b2 a1 a2 each (Float64Array); `at`: band b's sections are at[b] to at[b + 1] (Int32Array, one entry a band and one
 *  more); `st`: the sections' state, two each (Float64Array, transposed direct form II, as @audio/biquad's step).
 *  `set`: the bands' settings (BAND each); `bst`: their followers, the level and the RMS window's sum and position (3
 *  each); `rings`: each band's RMS window (Float32Array of its length, empty for peak). `tmp` (Float32Array) and `acc`
 *  (Float64Array): scratch as long as the block; a band is float32 between its sections. `g`: one setting for every
 *  compressing band, sample by sample, as a host's ramp moves it (the manifest's): threshold, ratio, makeup, depth,
 *  upThreshold and upRatio from 0, M, 2·M … 5·M (Float64Array); empty (the default), each band's own in `set`. */
export function multibandBlock (x, out, co, at, st, set, bst, rings, tmp, acc, g = HELD, M = 0) {
	let n = x.length, nb = at.length - 1
	for (let i = 0; i < n; i++) acc[i] = 0
	for (let b = 0; b < nb; b++) {
		for (let i = 0; i < n; i++) tmp[i] = x[i]
		for (let s = at[b]; s < at[b + 1]; s++) {
			let c = 5 * s, b0 = co[c], b1 = co[c + 1], b2 = co[c + 2], a1 = co[c + 3], a2 = co[c + 4], z1 = st[2 * s], z2 = st[2 * s + 1]
			for (let i = 0; i < n; i++) {
				let v = tmp[i], y = b0 * v + z1
				z1 = b1 * v - a1 * y + z2
				z2 = b2 * v - a2 * y
				tmp[i] = y
			}
			st[2 * s] = z1; st[2 * s + 1] = z2
		}
		if (set[b * BAND] === 1) squeeze(tmp, n, set, b * BAND, bst, 3 * b, rings[b], g, M)
		for (let i = 0; i < n; i++) acc[i] += tmp[i]
	}
	for (let i = 0; i < n; i++) out[i] = acc[i]
	return out
}
const HELD = new Float64Array(0)

// One band's compressor over d[0, n), in place, as @audio/dynamics-compressor 0.2's write: the follower, the level in
// dB (20·log10), the curves, the gain 10^(dB/20). With `lane` (multibandBlock's `g`), its settings sample by sample
function squeeze (d, n, set, o, bst, p, ring, lane, M) {
	let T = set[o + 1], R = set[o + 2], K = set[o + 3], mk = set[o + 4], depth = set[o + 5], up = set[o + 6] === 1
	let uT = set[o + 7], uR = set[o + 8], uK = set[o + 9], uG = set[o + 10], aa = set[o + 11], ar = set[o + 12], rms = set[o + 13] === 1
	let env = bst[p], sum = bst[p + 1], j = bst[p + 2] | 0, w = ring.length, ramp = lane.length > 0
	for (let i = 0; i < n; i++) {
		if (ramp) { T = lane[i]; R = lane[M + i]; mk = lane[2 * M + i]; depth = lane[3 * M + i]; uT = lane[4 * M + i]; uR = lane[5 * M + i] }
		let v = d[i], mag
		if (rms) {
			let sq = v * v
			sum += sq - ring[j]; ring[j] = sq; j = (j + 1) % w
			mag = Math.sqrt(Math.max(0, sum / w))
		} else mag = v < 0 ? -v : v
		let c = mag > env ? aa : ar
		env = c * env + (1 - c) * mag
		let db = 20 * Math.log10(Math.max(Math.abs(env), 1e-10))
		let g = compressorGain(db, T, R, K)
		if (up) g += upwardGain(db, uT, uR, uK, uG)
		d[i] = v * Math.pow(10, (g * depth + mk) / 20)
	}
	bst[p] = env; bst[p + 1] = sum; bst[p + 2] = j
}

// A band's options into `set` as compressor() read them (its defaults; the band's own sampleRate or fs over the
// multiband's); returns its RMS window, or none
const NONE = new Float32Array(0)
function bandSet (set, b, p, fs) {
	let o = b * BAND
	if (!p) { set[o] = 0; return NONE }
	let q = { fs, sampleRate: fs, ...p }, sr = q.sampleRate ?? q.fs ?? 44100, up = q.upThreshold ?? null, rms = (q.detector || 'peak') === 'rms'
	set[o] = 1; set[o + 1] = q.threshold ?? -20; set[o + 2] = q.ratio ?? 4; set[o + 3] = q.knee ?? 6; set[o + 4] = q.makeup ?? 0; set[o + 5] = q.depth ?? 1
	set[o + 6] = up == null ? 0 : 1; set[o + 7] = up ?? 0; set[o + 8] = q.upRatio ?? 2; set[o + 9] = q.upKnee ?? 6; set[o + 10] = q.upRange ?? 12
	set[o + 11] = timeCoef(q.attack ?? 5, sr); set[o + 12] = timeCoef(q.release ?? 100, sr); set[o + 13] = rms ? 1 : 0
	return rms ? new Float32Array(Math.max(1, q.rmsWindow || 256)) : NONE
}

// One-pole coefficient α = e^(−1/(τ·fs)), τ in ms, as @audio/dynamics-envelope computes it
function timeCoef (ms, sampleRate) {
	if (ms <= 0) return 0
	return Math.exp(-1 / (ms * 0.001 * sampleRate))
}

// The bands' sections, any order, from @audio/eq-crossover's pairs: each band's high-passes, its low-pass, its allpasses
function network (freqs, order, fs) {
	let pairs = freqs.map(f => crossover([f], order, fs)), list = [], at = [0]
	for (let b = 0; b <= freqs.length; b++) {
		for (let k = 0; k < b; k++) list.push(...pairs[k][1])
		if (b < freqs.length) list.push(...pairs[b][0])
		for (let k = b + 1; k < freqs.length; k++) for (let s of pairs[k][0].slice(0, pairs[k][0].length / 2)) list.push(allpass(s))
		at.push(list.length)
	}
	let co = new Float64Array(5 * list.length)
	list.forEach((s, i) => co.set([s.b0, s.b1, s.b2, s.a1, s.a2], 5 * i))
	return { co, at: Int32Array.from(at) }
}

// The allpass of a Butterworth section's denominator; a pass for a section held at silence or a pass (a cutoff at 0
// or past Nyquist), where LP + HP is 1
function allpass ({ b1, b2, a1, a2 }) {
	if (b1 === 0 && b2 === 0 && a1 === 0 && a2 === 0) return { b0: 1, b1: 0, b2: 0, a1: 0, a2: 0 }
	if (a2 === 0 && b2 === 0) return { b0: a1, b1: 1, b2: 0, a1, a2: 0 }
	return { b0: a2, b1: a1, b2: 1, a1, a2 }
}

/** The three-band LR4 network the manifest runs into `co` (Float64Array(55)), allocating nothing; `f`: Float64Array(3),
 *  the crossovers, low and high, and the sample rate (a number V8 passes to a call it does not inline is a new object;
 *  in a typed array it is not). Sections 0-2 the low band (LP at low twice, AP at high), 3-6 the mid (HP at low twice,
 *  LP at high twice), 7-10 the high (HP at low twice, HP at high twice), so at = [0, 3, 7, 11]. The numbers are those
 *  multiband() takes from @audio/eq-crossover at order 4. */
export function split3 (co, f) {
	lr4(XO, 0, f, 0); lr4(XO, 15, f, 1)
	for (let s = 0; s < 11; s++) for (let e = 0; e < 5; e++) co[5 * s + e] = XO[SPLIT3[s] + e]
	return co
}
const XO = new Float64Array(30)
// where each section's coefficients are in XO: the low crossover's LP, HP and AP at 0, 5, 10; the high one's at 15, 20, 25
const SPLIT3 = Int32Array.of(0, 0, 25, 5, 5, 15, 15, 5, 5, 20, 20)

// LR4 at fc = f[j], fs = f[2], into k from o: its Butterworth section's low-pass and high-pass, and their allpass, as
// eq-crossover gets them from digital-filter (butterworth(2) through the bilinear transform: the prototype pole
// −sin(π/4) ± j·cos(π/4), K = tan(π·fc/fs); a section held at silence or a pass for a cutoff at 0 or from Nyquist up),
// evaluated the same way
const SIG = -Math.sin(Math.PI * 1 / 4), OM = Math.cos(Math.PI * 1 / 4)
function lr4 (k, o, f, j) {
	let fc = f[j], fs = f[2]
	k.fill(0, o, o + 15)
	if (fc <= 0) { k[o + 5] = 1; k[o + 10] = 1; return }
	if (fc >= fs / 2) { k[o] = 1; k[o + 10] = 1; return }
	let K = Math.tan(Math.PI * fc / fs), C = 1 / K, pmag2 = SIG * SIG + OM * OM, bs = -2 * SIG
	let A = C * C + bs * C + pmag2
	k[o] = pmag2 / A; k[o + 1] = 2 * pmag2 / A; k[o + 2] = pmag2 / A; k[o + 3] = 2 * (pmag2 - C * C) / A; k[o + 4] = (C * C - bs * C + pmag2) / A
	let B1 = bs / pmag2, B0 = 1 / pmag2
	A = C * C + B1 * C + B0
	k[o + 5] = C * C / A; k[o + 6] = -2 * C * C / A; k[o + 7] = C * C / A; k[o + 8] = 2 * (B0 - C * C) / A; k[o + 9] = (C * C - B1 * C + B0) / A
	k[o + 10] = k[o + 4]; k[o + 11] = k[o + 3]; k[o + 12] = 1; k[o + 13] = k[o + 3]; k[o + 14] = k[o + 4]
}

/** Seconds the manifest's output takes to fall 60 dB under the input's level once the input stops, its low crossover
 *  at `low`. The slowest poles are that crossover's: a pair of radius r = √a2, doubled (LR4 squares its Butterworth
 *  section), so the ring decays as n·rⁿ, slower than one pole's rⁿ, which falls 60 dB in ln(1000)/−ln r samples (J. O.
 *  Smith, "Introduction to Digital Filters", the decay time of a one-pole). n·rⁿ is D dB under its peak where
 *  t·e^(1−t) = 10^(−D/20), t = −n·ln r: t ≈ 10.24 for 60 dB. `lift`: dB the band compressors may raise the ring by
 *  (makeup, the upward lift), so D = 60 + lift. */
export function tail (low, sampleRate, lift = 0) {
	F[0] = low; F[2] = sampleRate
	lr4(XO2, 0, F, 0)
	let a2 = XO2[4]
	if (!(a2 > 0)) return 0
	let a = (60 + Math.max(0, lift)) * Math.LN10 / 20, t = 1 + a
	for (let i = 0; i < 8; i++) t = 1 + a + Math.log(t)
	return t / (-Math.log(a2) / 2) / sampleRate
}
const XO2 = new Float64Array(15), F = new Float64Array(3)
