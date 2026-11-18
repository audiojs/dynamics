// atom manifest — vari-mu compressor (Fairchild class: feedback topology, very soft
// wide knee, slow attack, ratio grows with drive). Every param is live: read each
// block, the attack and release coefficients recomputed when their value changes, the
// follower and the gain reduction kept, so a change is heard from the next sample with
// no jump in the gain. State and settings are typed arrays made here; a block allocates
// nothing. No tail: the output is the input times a gain, silent when the input is.
// threshold and knee reach the output through the gain reduction's attack and release.
// makeup scales the output with nothing behind it, so it is smoothed (20 ms) and glided
// sample by sample (util.js glide): a host's ramp of it is one line of the gain,
// however the host cut its calls. Held, it is k's, and the kernel runs as it ran.

import { varimuBlock } from './varimu.js'
import { timeCoef, glide, GLIDE } from './util.js'

export const varimu = (ctx) => {
	const sr = ctx.sampleRate, st = [], rings = [], k = new Float64Array(6), at = new Float64Array(2).fill(NaN)
	const g = new Float64Array(GLIDE).fill(NaN), mk = new Float64Array(ctx.maxBlockSize)
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) { st.push(new Float64Array(4)); rings.push(new Float32Array(256)) }
	k[5] = timeCoef(1, sr)
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		const a = params.attack[0], r = params.release[0]
		k[0] = params.threshold[0]; k[1] = params.knee[0]; k[2] = params.makeup[0]
		if (a !== at[0]) { at[0] = a; k[3] = timeCoef(a, sr) }
		if (r !== at[1]) { at[1] = r; k[4] = timeCoef(r, sr) }
		const ramp = glide(g, 0, params.makeup, mk, 0, inp[0].length, 0) ? mk : undefined
		for (let c = 0; c < inp.length; c++) varimuBlock(inp[c], out[c], st[c], rings[c], k, ramp)
	}
}
varimu.channels = 'any'
varimu.tail = 0
varimu.params = {
	threshold: { type: 'number', min: -60, max: 0, default: -22, unit: 'dB' },
	knee:      { type: 'number', min: 6, max: 30, default: 15, unit: 'dB' },
	attack:    { type: 'number', min: 5, max: 200, default: 25, unit: 'ms' },
	release:   { type: 'number', min: 50, max: 2000, default: 400, unit: 'ms' },
	makeup:    { type: 'number', min: -12, max: 24, default: 0, unit: 'dB', smoothing: 0.02 },
}
