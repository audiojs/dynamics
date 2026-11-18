// atom manifest — wraps the dynamics expander kernel per @audio/compile CONTRACT.
// Every param is live: read each block, the follower's attack and release coefficients
// recomputed when their value changes, its state kept, so a change is heard from the
// next sample with no jump in the gain. State and settings are typed arrays made here;
// a block allocates nothing.
// `mode` picks the curve (enum pattern mirrors deesser's `mode`): 'downward' (default)
// reduces gain below threshold; 'upward' raises gain above threshold — de-compression,
// the substrate for de-limiting over-squashed material. Both curves share the same
// envelope shape, only the gain formula switches.
// `range` is exposed as a magnitude (≥ 0), sign-applied by mode inside the processor,
// so switching modes can never strand a stale sign-mismatched value.
// Input bus 1 is the key (fed by the `key` option): when it carries channels the
// follower reads them in place of the input (util.js keyed). `link` mixes each channel's
// level toward the loudest channel's (util.js link): every channel's level is read
// before any channel's gain, into rows made here by ctx.maxBlockSize. At link 0 and no
// key the kernel runs as expandBlock does, sample for sample.
// The follower reads the input; the curve's gain is applied with nothing behind it. So
// threshold, ratio, knee, range and link each set the gain at once: each is smoothed
// (20 ms) and glided sample by sample (util.js glide), so a host's ramp of it is one
// line, however the host cut its calls. The range glides as a magnitude: a mode switch
// changes the curve at once (an enum does not glide) and never sweeps the range through 0.
// While none of the curve's four moves, they are k's, and the kernel runs as it ran.

import { expandLevel, expandGain } from './expander.js'
import { coefAt, keyed, link, glide, GLIDE } from './util.js'

export const expander = (ctx) => {
	const sr = ctx.sampleRate, M = ctx.maxBlockSize, st = [], lev = [], ring = new Float32Array(0), k = new Float64Array(8), at = new Float64Array(2).fill(NaN)
	const g = new Float64Array(5 * GLIDE).fill(NaN), lanes = new Float64Array(5 * M)
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) { st.push(new Float64Array(3)); lev.push(new Float64Array(M)) }
	return (inputs, outputs, params) => {
		const inp = inputs[0], key = inputs[1], out = outputs[0]
		if (!inp || !inp.length) return
		const upward = params.mode === 'upward', a = params.attack[0], r = params.release[0], ln = params.link[0], nc = inp.length, n = inp[0].length
		k[0] = upward ? 1 : 0; k[1] = params.threshold[0]; k[2] = params.ratio[0]; k[3] = params.knee[0]
		k[4] = upward ? params.range[0] : -params.range[0]
		const moving = glide(g, 0, params.threshold, lanes, 0, n, 0) | glide(g, 1, params.ratio, lanes, M, n, 0) | glide(g, 2, params.knee, lanes, 2 * M, n, 0) | glide(g, 3, params.range, lanes, 3 * M, n, 0)
		const linking = glide(g, 4, params.link, lanes, 4 * M, n, 0)
		if (a !== at[0]) { at[0] = a; coefAt(k, 5, at, 0, sr) }
		if (r !== at[1]) { at[1] = r; coefAt(k, 6, at, 1, sr) }
		for (let c = 0; c < nc; c++) expandLevel(keyed(key, inp, c), lev[c], st[c], ring, k)
		if ((linking || ln > 0) && nc > 1) link(lev, nc, n, lanes, 4 * M)
		for (let c = 0; c < nc; c++) expandGain(inp[c], lev[c], out[c], k, moving ? lanes : undefined, M)
	}
}
expander.channels = { inputs: [{ channels: 'any' }, { channels: 'any', name: 'key' }], outputs: 'any' }
expander.tail = 0
expander.params = {
	mode:      { type: 'enum', values: ['downward', 'upward'], default: 'downward' },
	threshold: { type: 'number', min: -80, max: 0, default: -30, smoothing: 0.02, unit: 'dB' },
	ratio:     { type: 'number', min: 1, max: 20, default: 2, smoothing: 0.02 },
	knee:      { type: 'number', min: 0, max: 24, default: 6, unit: 'dB', smoothing: 0.02 },
	range:     { type: 'number', min: 0, max: 90, default: 40, unit: 'dB', smoothing: 0.02 },
	attack:    { type: 'number', min: 0.1, max: 100, default: 5, unit: 'ms' },
	release:   { type: 'number', min: 1, max: 1000, default: 50, unit: 'ms' },
	link:      { type: 'number', min: 0, max: 1, default: 0, smoothing: 0.02 },
}
