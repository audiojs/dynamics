// Optical compressor model (LA-2A class) — RMS detection, wide soft knee, ~3:1, and the
// T4 signature: program-dependent release that slows the longer gain reduction persists.
import { compressorGain } from '@audio/dynamics-compressor'
import { writer, concat, db2lin, lin2db, timeCoef } from './util.js'

export default function opto (data, opts) {
	if (!(data instanceof Float32Array)) return writer(optoStream(data))
	let s = optoStream(opts)
	return concat(s.write(data), s.flush())
}

export function optoStream (opts = {}) {
	let sr = opts.sampleRate || opts.fs || 44100
	let aCoef = timeCoef(opts.attack ?? 10, sr)
	// the RMS follower attacks with the gain and releases in 1 ms; the T4 memory integrates ~3 s of history
	let k = Float64Array.of(opts.threshold ?? -20, opts.ratio ?? 3, opts.knee ?? 10, opts.makeup ?? 0, aCoef, timeCoef(1, sr), timeCoef(3000, sr), opts.release ?? 300, sr)
	let s = new Float64Array(5), ring = new Float32Array(Math.max(1, opts.rmsWindow || 256))

	return {
		write (chunk) { return optoBlock(chunk, new Float32Array(chunk.length), s, ring, k) },
		flush () { return new Float32Array(0) }
	}
}

/** One block of one channel into `out` (which may be `x`), allocating nothing. `s`, the state: Float64Array(5), the
 *  RMS follower, the gain reduction in dB, the T4 memory, the window's sum and position; `ring`, the window's squares
 *  (Float32Array of its length). `k`, the settings: Float64Array(9), threshold, ratio, knee and makeup (dB), the
 *  attack coefficient (gain and follower), the follower's release coefficient, the memory's coefficient, the nominal
 *  release (ms, stretched up to 7× by the memory), the sample rate. */
export function optoBlock (x, out, s, ring, k) {
	if (LEV.length < x.length) LEV = new Float64Array(x.length)
	optoLevel(x, LEV, s, ring, k)
	return optoGain(x, LEV, out, s, k)
}
let LEV = new Float64Array(0)

/** optoBlock's RMS follower: its level after each sample of `x` into `lev` (Float64Array, as long or longer), linear.
 *  optoLevel then optoGain is optoBlock, with room between them for a level from elsewhere (a key, the loudest of
 *  linked channels). */
export function optoLevel (x, lev, s, ring, k) {
	let aC = k[4], rE = k[5], n = ring.length
	let env = s[0], sum = s[3], j = s[4] | 0
	for (let i = 0; i < x.length; i++) {
		let v = x[i], sq = v * v
		sum += sq - ring[j]; ring[j] = sq; j = (j + 1) % n
		let mag = Math.sqrt(Math.max(0, sum / n)), c = mag > env ? aC : rE
		env = c * env + (1 - c) * mag
		lev[i] = env
	}
	s[0] = env; s[3] = sum; s[4] = j
}

/** optoBlock's gain: `x` into `out` (which may be `x`), each sample by the gain reduction its level in `lev` (as
 *  optoLevel gives it) calls for, smoothed, its release stretched by the T4 memory. `mk`: the makeup (dB) for each
 *  sample (Float64Array, as long or longer), as a host's ramp moves it; empty (the default), `k`'s. */
export function optoGain (x, lev, out, s, k, mk = NONE) {
	let T = k[0], R = k[1], W = k[2], m = k[3], aC = k[4], mC = k[6], rel = k[7], sr = k[8], ramp = mk.length > 0
	let gr = s[1], memory = s[2]
	for (let i = 0; i < x.length; i++) {
		let target = compressorGain(lin2db(lev[i]), T, R, W)
		memory = memory * mC + (target < -1 ? 1 - mC : 0)
		let rCoef = timeCoef(rel * (1 + 6 * memory), sr)
		gr = target < gr ? target + (gr - target) * aC : target + (gr - target) * rCoef
		out[i] = x[i] * db2lin(gr + (ramp ? mk[i] : m))
	}
	s[1] = gr; s[2] = memory
	return out
}
const NONE = new Float64Array(0)
