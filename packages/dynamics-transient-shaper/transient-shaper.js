/**
 * Transient shaper — independently boosts/cuts attack and sustain portions.
 * A level follower (1 ms attack, 100 ms release) and a slow follower of that level
 * (50 ms attack, instant release) separate transient from sustain.
 */

let {abs, exp} = Math

export default function transientShaper (data, params) {
	let attackGain = params.attackGain ?? 0     // linear gain delta: >0 emphasize, <0 suppress
	let sustainGain = params.sustainGain ?? 0
	let fs = params.fs || 44100

	let aFast = exp(-1 / (0.001 * fs))
	let aSlow = exp(-1 / (0.05 * fs))
	let aRel = exp(-1 / (0.1 * fs))

	let envFast = params._envFast ?? 0
	let envSlow = params._envSlow ?? 0

	for (let i = 0, l = data.length; i < l; i++) {
		let x = data[i]
		let xAbs = abs(x)

		// Level: fast attack, slow release
		envFast = xAbs > envFast ? aFast * envFast + (1 - aFast) * xAbs : aRel * envFast
		// Slow copy of the level: rises 50× slower, falls with it, so it never exceeds it
		envSlow = envFast > envSlow ? aSlow * envSlow + (1 - aSlow) * envFast : envFast

		// Transient share of the level, 0..1: near 1 on attacks, near 0 on held material
		let transient = envFast > 1e-10 ? (envFast - envSlow) / envFast : 0

		// Gain stays within 1 + [min, max] of the two gains
		let gain = 1 + attackGain * transient + sustainGain * (1 - transient)
		data[i] = x * gain
	}

	params._envFast = envFast
	params._envSlow = envSlow

	return data
}
