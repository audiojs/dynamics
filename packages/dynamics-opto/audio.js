// atom manifest — optical compressor (LA-2A class: RMS detection, wide soft knee,
// ~3:1, T4 program-dependent release that slows the longer reduction persists).
// Every param is live: read each block, the attack coefficient recomputed when its
// value changes, the follower, the gain reduction and the T4 memory kept, so a change
// is heard from the next sample with no jump in the gain. State and settings are typed
// arrays made here; a block allocates nothing. No tail: the output is the input times
// a gain, silent when the input is (the memory only slows the release of that gain).
// Input bus 1 is the key (fed by the `key` option): when it carries channels the
// follower reads them in place of the input (util.js keyed). `link` mixes each channel's
// level toward the loudest channel's (util.js link): every channel's level is read
// before any channel's gain, into rows made here by ctx.maxBlockSize. At link 0 and no
// key the kernel runs as optoBlock does, sample for sample.
// threshold, ratio and knee reach the output through the gain reduction's attack and
// release. makeup scales the output with nothing behind it, so it is smoothed (20 ms)
// and glided sample by sample (util.js glide): a host's ramp of it is one line of the
// gain, however the host cut its calls. Held, it is k's, and the kernel runs as it ran.

import { optoLevel, optoGain } from './opto.js'
import { timeCoef, keyed, link, coefAt, glide, GLIDE } from './util.js'

export const opto = (ctx) => {
	const sr = ctx.sampleRate, st = [], rings = [], lev = [], k = new Float64Array(9), at = new Float64Array(1).fill(NaN)
	const g = new Float64Array(GLIDE).fill(NaN), mk = new Float64Array(ctx.maxBlockSize)
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) { st.push(new Float64Array(5)); rings.push(new Float32Array(256)); lev.push(new Float64Array(ctx.maxBlockSize)) }
	k[5] = timeCoef(1, sr); k[6] = timeCoef(3000, sr); k[7] = 300; k[8] = sr
	return (inputs, outputs, params) => {
		const inp = inputs[0], key = inputs[1], out = outputs[0]
		if (!inp || !inp.length) return
		const a = params.attack[0], ln = params.link[0], nc = inp.length, n = inp[0].length
		k[0] = params.threshold[0]; k[1] = params.ratio[0]; k[2] = params.knee[0]; k[3] = params.makeup[0]
		if (a !== at[0]) { at[0] = a; coefAt(k, 4, at, 0, sr) }
		const ramp = glide(g, 0, params.makeup, mk, 0, n, 0) ? mk : undefined
		for (let c = 0; c < nc; c++) optoLevel(keyed(key, inp, c), lev[c], st[c], rings[c], k)
		if (ln > 0 && nc > 1) link(lev, nc, n, params.link)
		for (let c = 0; c < nc; c++) optoGain(inp[c], lev[c], out[c], st[c], k, ramp)
	}
}
opto.channels = { inputs: [{ channels: 'any' }, { channels: 'any', name: 'key' }], outputs: 'any' }
opto.tail = 0
opto.params = {
	threshold: { type: 'number', min: -60, max: 0, default: -20, unit: 'dB' },
	ratio:     { type: 'number', min: 1.5, max: 6, default: 3 },
	knee:      { type: 'number', min: 4, max: 24, default: 10, unit: 'dB' },
	attack:    { type: 'number', min: 1, max: 100, default: 10, unit: 'ms' },
	makeup:    { type: 'number', min: -12, max: 24, default: 0, unit: 'dB', smoothing: 0.02 },
	link:      { type: 'number', min: 0, max: 1, default: 0, smoothing: 0.01 },
}
