// Vari-Mu compressor model (Fairchild class) — feedback topology (detector reads the
// output), very soft wide knee, slow attack, and ratio that grows with drive (the "mu").
import { compressorGain } from '@audio/dynamics-compressor'
import { writer, concat, db2lin, lin2db, timeCoef } from './util.js'

export default function varimu (data, opts) {
	if (!(data instanceof Float32Array)) return writer(varimuStream(data))
	let s = varimuStream(opts)
	return concat(s.write(data), s.flush())
}

export function varimuStream (opts = {}) {
	let sr = opts.sampleRate || opts.fs || 44100
	// the RMS follower attacks with the gain and releases in 1 ms
	let k = Float64Array.of(opts.threshold ?? -22, opts.knee ?? 15, opts.makeup ?? 0, timeCoef(opts.attack ?? 25, sr), timeCoef(opts.release ?? 400, sr), timeCoef(1, sr))
	let s = new Float64Array(4), ring = new Float32Array(Math.max(1, opts.rmsWindow || 256))

	return {
		write (chunk) { return varimuBlock(chunk, new Float32Array(chunk.length), s, ring, k) },
		flush () { return new Float32Array(0) }
	}
}

/** One block of one channel into `out` (which may be `x`), allocating nothing. `s`, the state: Float64Array(4), the
 *  RMS follower, the gain reduction in dB, the window's sum and position; `ring`, the window's squares (Float32Array of
 *  its length). `k`, the settings: Float64Array(6), threshold, knee and makeup (dB), the attack coefficient (gain and
 *  follower), the gain's release coefficient, the follower's release coefficient. The follower reads the output (the
 *  feedback) and is stepped twice a sample, once for the drive and once for the gain, so its attack acts in half the
 *  set time and its window spans half as many samples. `mk`: the makeup (dB) for each sample (Float64Array, as long or
 *  longer), as a host's ramp moves it; empty (the default), `k`'s. The follower reads the output before makeup. */
export function varimuBlock (x, out, s, ring, k, mk = NONE) {
	let T = k[0], W = k[1], m = k[2], aC = k[3], rC = k[4], rE = k[5], n = ring.length, ramp = mk.length > 0
	let env = s[0], gr = s[1], sum = s[2], j = s[3] | 0
	for (let i = 0; i < x.length; i++) {
		let v = x[i], y = v * db2lin(gr), sq = y * y, mu = 0          // feedback: detect the compressed output
		for (let t = 0; t < 2; t++) {
			sum += sq - ring[j]; ring[j] = sq; j = (j + 1) % n
			let mag = Math.sqrt(Math.max(0, sum / n)), c = mag > env ? aC : rE
			env = c * env + (1 - c) * mag
			if (!t) mu = 1.8 + Math.max(0, lin2db(env) - T) / 5        // ratio grows with drive
		}
		let target = compressorGain(lin2db(env), T, mu, W)
		gr = target < gr ? target + (gr - target) * aC : target + (gr - target) * rC
		out[i] = v * db2lin(gr + (ramp ? mk[i] : m))
	}
	s[0] = env; s[1] = gr; s[2] = sum; s[3] = j
	return out
}
const NONE = new Float64Array(0)
