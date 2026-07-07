/**
 * Transient shaper — independently boosts/cuts attack and sustain portions.
 * Uses dual envelope followers (fast/slow) to separate transients.
 */

let {abs, exp, max} = Math

export default function transientShaper (data, params) {
	let attackGain = params.attackGain ?? 0     // dB-like multiplier: >0 emphasize, <0 suppress
	let sustainGain = params.sustainGain ?? 0
	let fs = params.fs || 44100

	// Fast envelope tracks transients, slow envelope tracks sustain
	let aFast = exp(-1 / (0.001 * fs))
	let aSlow = exp(-1 / (0.05 * fs))

	let envFast = params._envFast ?? 0
	let envSlow = params._envSlow ?? 0

	for (let i = 0, l = data.length; i < l; i++) {
		let x = data[i]
		let xAbs = abs(x)

		if (xAbs > envFast) envFast = aFast * envFast + (1 - aFast) * xAbs
		else envFast = aSlow * envFast

		if (xAbs > envSlow) envSlow = aSlow * envSlow + (1 - aSlow) * xAbs
		else envSlow = aSlow * envSlow + (1 - aSlow) * xAbs

		// Transient = fast - slow; sustain ≈ slow
		let diff = max(envFast - envSlow, 0)
		let transient = envSlow > 1e-10 ? diff / envSlow : 0

		// Apply: boost transient part, boost sustain part
		let gain = 1 + attackGain * transient + sustainGain * (1 - transient)
		data[i] = x * gain
	}

	params._envFast = envFast
	params._envSlow = envSlow

	return data
}
