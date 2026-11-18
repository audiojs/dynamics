// atom manifest — VCA compressor (dbx/SSL-bus class: clean feed-forward peak
// detection, near-hard knee, dB-linear gain). Every param is live: read each block,
// the attack and release coefficients recomputed when their value changes, the
// follower and the gain reduction kept, so a change is heard from the next sample
// with no jump in the gain. State and settings are typed arrays made here; a block
// allocates nothing. No tail: the output is the input times a gain, silent when the
// input is.
// Input bus 1 is the key (fed by the `key` option): when it carries channels the
// follower reads them in place of the input (util.js keyed). `link` mixes each channel's
// level toward the loudest channel's (util.js link): every channel's level is read
// before any channel's gain, into rows made here by ctx.maxBlockSize. At link 0 and no
// key the kernel runs as vcaBlock does, sample for sample.
// threshold, ratio and knee reach the output through the gain reduction's attack and
// release. makeup scales the output with nothing behind it, so it is smoothed (20 ms)
// and glided sample by sample (util.js glide): a host's ramp of it is one line of the
// gain, however the host cut its calls. Held, it is k's, and the kernel runs as it ran.

import { vcaLevel, vcaGain } from './vca.js'
import { timeCoef, keyed, link, coefAt, glide, GLIDE } from './util.js'

export const vca = (ctx) => {
	const sr = ctx.sampleRate, st = [], lev = [], k = new Float64Array(8), at = new Float64Array(2).fill(NaN)
	const g = new Float64Array(GLIDE).fill(NaN), mk = new Float64Array(ctx.maxBlockSize)
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) { st.push(new Float64Array(2)); lev.push(new Float64Array(ctx.maxBlockSize)) }
	k[7] = timeCoef(1, sr)
	return (inputs, outputs, params) => {
		const inp = inputs[0], key = inputs[1], out = outputs[0]
		if (!inp || !inp.length) return
		const a = params.attack[0], r = params.release[0], ln = params.link[0], nc = inp.length, n = inp[0].length
		k[0] = params.threshold[0]; k[1] = params.ratio[0]; k[2] = params.knee[0]; k[3] = params.makeup[0]
		if (a !== at[0]) { at[0] = a; coefAt(k, 4, at, 0, sr); k[6] = k[4] }
		if (r !== at[1]) { at[1] = r; coefAt(k, 5, at, 1, sr) }
		const ramp = glide(g, 0, params.makeup, mk, 0, n, 0) ? mk : undefined
		for (let c = 0; c < nc; c++) vcaLevel(keyed(key, inp, c), lev[c], st[c], k)
		if (ln > 0 && nc > 1) link(lev, nc, n, params.link)
		for (let c = 0; c < nc; c++) vcaGain(inp[c], lev[c], out[c], st[c], k, ramp)
	}
}
vca.channels = { inputs: [{ channels: 'any' }, { channels: 'any', name: 'key' }], outputs: 'any' }
vca.tail = 0
vca.params = {
	threshold: { type: 'number', min: -60, max: 0, default: -20, unit: 'dB' },
	ratio:     { type: 'number', min: 1, max: 20, default: 4 },
	knee:      { type: 'number', min: 0, max: 12, default: 1, unit: 'dB' },
	attack:    { type: 'number', min: 0.1, max: 100, default: 1, unit: 'ms' },
	release:   { type: 'number', min: 20, max: 2000, default: 150, unit: 'ms' },
	makeup:    { type: 'number', min: -12, max: 24, default: 0, unit: 'dB', smoothing: 0.02 },
	link:      { type: 'number', min: 0, max: 1, default: 0, smoothing: 0.01 },
}
