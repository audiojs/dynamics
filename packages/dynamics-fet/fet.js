// FET compressor model (1176 class) — very fast peak detection (0.2 ms default attack),
// fixed-style high ratios, firm knee. Character = speed, not color.
import { compressorGain } from '@audio/dynamics-compressor'
import { writer, concat, db2lin, lin2db, timeCoef } from './util.js'

export default function fet (data, opts) {
	if (!(data instanceof Float32Array)) return writer(fetStream(data))
	let s = fetStream(opts)
	return concat(s.write(data), s.flush())
}

export function fetStream (opts = {}) {
	let sr = opts.sampleRate || opts.fs || 44100
	let aCoef = timeCoef(opts.attack ?? 0.2, sr)
	// the peak follower attacks with the gain and releases in 1 ms
	let k = Float64Array.of(opts.threshold ?? -18, opts.ratio ?? 8, opts.knee ?? 3, opts.makeup ?? 0, aCoef, timeCoef(opts.release ?? 120, sr), aCoef, timeCoef(1, sr))
	let s = new Float64Array(2)

	return {
		write (chunk) { return fetBlock(chunk, new Float32Array(chunk.length), s, k) },
		flush () { return new Float32Array(0) }
	}
}

/** One block of one channel into `out` (which may be `x`), allocating nothing. `s`, the state: Float64Array(2), the
 *  peak follower and the gain reduction in dB. `k`, the settings: Float64Array(8), threshold, ratio, knee and makeup
 *  (dB), the gain's attack and release coefficients, the follower's attack and release coefficients. Its two halves,
 *  fetLevel and fetGain, let a level come from elsewhere between them (a key, the loudest of linked channels). */
export function fetBlock (x, out, s, k) {
	if (LEV.length < x.length) LEV = new Float64Array(x.length)
	fetLevel(x, LEV, s, k)
	return fetGain(x, LEV, out, s, k)
}
let LEV = new Float64Array(0)

/** fetBlock's follower: its level after each sample of `x` into `lev` (Float64Array, as long or longer), linear. */
export function fetLevel (x, lev, s, k) {
	let aE = k[6], rE = k[7], env = s[0]
	for (let i = 0; i < x.length; i++) {
		let v = x[i], mag = v < 0 ? -v : v, c = mag > env ? aE : rE
		env = c * env + (1 - c) * mag
		lev[i] = env
	}
	s[0] = env
}

/** fetBlock's gain: `x` into `out` (which may be `x`), each sample by the gain reduction its level in `lev` (as
 *  fetLevel gives it) calls for, smoothed. `mk`: the makeup (dB) for each sample (Float64Array, as long or longer), as a
 *  host's ramp moves it; empty (the default), `k`'s. */
export function fetGain (x, lev, out, s, k, mk = NONE) {
	let T = k[0], R = k[1], W = k[2], m = k[3], aC = k[4], rC = k[5], gr = s[1], ramp = mk.length > 0
	for (let i = 0; i < x.length; i++) {
		let target = compressorGain(lin2db(lev[i]), T, R, W)
		gr = target < gr ? target + (gr - target) * aC : target + (gr - target) * rC
		out[i] = x[i] * db2lin(gr + (ramp ? mk[i] : m))
	}
	s[1] = gr
	return out
}
const NONE = new Float64Array(0)
