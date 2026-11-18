// atom manifest — wraps the dynamics compressor kernel per @audio/compile CONTRACT.
// Every param is live: read each block, the smoother's attack and release coefficients
// recomputed when their value changes, its poles kept, so a change is heard from the
// next sample with no jump in the gain. State and settings are typed arrays made here
// (compressLevel and compressGain, the halves of compress); a block allocates nothing.
// Upward compression (below threshold) sums with downward in the dB domain — see
// compressor.js. The params convention has no null, so upRatio defaults to 1: a
// mathematical no-op (upwardGain ≡ 0 for any threshold/knee/level when ratio is 1),
// which is the off-switch here in place of the kernel's `upThreshold: null`.
// Input bus 1 is the key (fed by the `key` option): when it carries channels the
// detector reads them in place of the input (util.js keyed). `link` mixes each channel's
// level toward the loudest channel's (util.js link): every channel's level is read
// before any channel's gain, into rows made here by ctx.maxBlockSize. At link 0 and no
// key the kernel runs as compress does, sample for sample.
// No tail: the output is the input times a gain, silent when the input is.
// The curves' settings reach the output through the smoother. makeup scales the output
// with nothing behind it, so it is smoothed (20 ms) and glided sample by sample (util.js
// glide): a host's ramp of it is one line of the gain, however the host cut its calls.
// Held, it is k's, and the kernel runs as it ran.

import { compressLevel, compressGain } from './compressor.js'
import { coefAt, keyed, link, glide, GLIDE } from './util.js'

export const compressor = (ctx) => {
	const sr = ctx.sampleRate, st = [], lev = [], buf = new Float64Array(0), k = new Float64Array(14), at = new Float64Array(2).fill(NaN)
	const g = new Float64Array(GLIDE).fill(NaN), mk = new Float64Array(ctx.maxBlockSize)
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) { st.push(new Float64Array(4)); lev.push(new Float64Array(ctx.maxBlockSize)) }
	k[3] = 1; k[8] = 1   // upward on (upRatio 1 is its off), depth 1; peak detection
	return (inputs, outputs, params) => {
		const inp = inputs[0], key = inputs[1], out = outputs[0]
		if (!inp || !inp.length) return
		const a = params.attack[0], r = params.release[0], ln = params.link[0], nc = inp.length, n = inp[0].length
		k[0] = params.threshold[0]; k[1] = params.ratio[0]; k[2] = params.knee[0]
		k[4] = params.upThreshold[0]; k[5] = params.upRatio[0]; k[6] = params.upKnee[0]; k[7] = params.upRange[0]; k[9] = params.makeup[0]
		if (a !== at[0]) { at[0] = a; coefAt(k, 10, at, 0, sr) }
		if (r !== at[1]) { at[1] = r; coefAt(k, 11, at, 1, sr) }
		const ramp = glide(g, 0, params.makeup, mk, 0, n, 0) ? mk : undefined
		for (let c = 0; c < nc; c++) compressLevel(keyed(key, inp, c), lev[c], st[c], k, buf)
		if (ln > 0 && nc > 1) link(lev, nc, n, params.link)
		for (let c = 0; c < nc; c++) compressGain(inp[c], lev[c], out[c], st[c], k, ramp)
	}
}
compressor.channels = { inputs: [{ channels: 'any' }, { channels: 'any', name: 'key' }], outputs: 'any' }
compressor.tail = 0
compressor.params = {
	threshold:   { type: 'number', min: -60, max: 0, default: -20, smoothing: 0.01, unit: 'dB' },
	ratio:       { type: 'number', min: 1, max: 20, default: 4 },
	knee:        { type: 'number', min: 0, max: 24, default: 6, unit: 'dB' },
	makeup:      { type: 'number', min: -12, max: 24, default: 0, unit: 'dB', smoothing: 0.02 },
	upThreshold: { type: 'number', min: -80, max: 0, default: -40, smoothing: 0.01, unit: 'dB' },
	upRatio:     { type: 'number', min: 1, max: 20, default: 1 },
	upKnee:      { type: 'number', min: 0, max: 24, default: 6, unit: 'dB' },
	upRange:     { type: 'number', min: 0, max: 40, default: 12, unit: 'dB' },
	attack:      { type: 'number', min: 0.1, max: 100, default: 5, unit: 'ms' },
	release:     { type: 'number', min: 1, max: 1000, default: 100, unit: 'ms' },
	link:        { type: 'number', min: 0, max: 1, default: 0, smoothing: 0.01 },
}
