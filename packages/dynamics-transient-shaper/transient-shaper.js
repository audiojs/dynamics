/**
 * Transient shaper — independently boosts/cuts attack and sustain portions.
 * A level follower (1 ms attack, 100 ms release) and a slow follower of that level
 * (50 ms attack, instant release) separate transient from sustain.
 */

let {abs, exp} = Math

export default function transientShaper (data, params) {
	let s = ENV, k = SET
	transientSet(k, params.fs || 44100)
	k[3] = params.attackGain ?? 0     // linear gain delta: >0 emphasize, <0 suppress
	k[4] = params.sustainGain ?? 0
	s[0] = params._envFast ?? 0
	s[1] = params._envSlow ?? 0
	transientBlock(data, data, s, k)
	params._envFast = s[0]
	params._envSlow = s[1]
	return data
}
const ENV = new Float64Array(2), SET = new Float64Array(5)

/** The followers' coefficients at `fs` Hz into `k`'s first three slots (transientBlock's): the level's attack (1 ms)
 *  and release (100 ms), its slow copy's rise (50 ms). */
export function transientSet (k, fs) {
	k[0] = exp(-1 / (0.001 * fs))
	k[1] = exp(-1 / (0.05 * fs))
	k[2] = exp(-1 / (0.1 * fs))
	return k
}

/** One block of one channel into `out` (which may be `x`), allocating nothing. `s`, the state: Float64Array(2), the
 *  level and its slow copy. `k`, the settings: Float64Array(5), transientSet's three coefficients, attackGain and
 *  sustainGain. `g`: attackGain and sustainGain for each sample, as a host's ramp moves them (Float64Array, from 0 and
 *  M); empty (the default), `k`'s. */
export function transientBlock (x, out, s, k, g = NONE, M = 0) {
	let aFast = k[0], aSlow = k[1], aRel = k[2], attackGain = k[3], sustainGain = k[4], ramp = g.length > 0
	let envFast = s[0], envSlow = s[1]
	for (let i = 0, l = x.length; i < l; i++) {
		if (ramp) { attackGain = g[i]; sustainGain = g[M + i] }
		let v = x[i]
		let xAbs = abs(v)

		// Level: fast attack, slow release
		envFast = xAbs > envFast ? aFast * envFast + (1 - aFast) * xAbs : aRel * envFast
		// Slow copy of the level: rises 50× slower, falls with it, so it never exceeds it
		envSlow = envFast > envSlow ? aSlow * envSlow + (1 - aSlow) * envFast : envFast

		// Transient share of the level, 0..1: near 1 on attacks, near 0 on held material
		let transient = envFast > 1e-10 ? (envFast - envSlow) / envFast : 0

		// Gain stays within 1 + [min, max] of the two gains
		let gain = 1 + attackGain * transient + sustainGain * (1 - transient)
		out[i] = v * gain
	}
	s[0] = envFast
	s[1] = envSlow
	return out
}
const NONE = new Float64Array(0)
