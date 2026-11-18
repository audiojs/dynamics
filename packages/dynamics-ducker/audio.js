// atom manifest — wraps the external-sidechain ducker kernel per @audio/compile
// CONTRACT §channels. The kernel cleanly separates the key input (duckerStream.write(main,
// side) takes two distinct signals), so this declares a genuine two-bus layout: main +
// key in, main out, each of any count, as the compressor, expander, gate, fet, opto and
// vca declare theirs. Every param is live: read each block, the follower's attack and
// release coefficients recomputed when their value changes, its state kept, so a change
// is heard from the next sample with no jump in the gain. State and settings are typed
// arrays made here; a block allocates nothing.
//
// NOTE: the audio host feeds bus 1 from its `key` option (chain.ducker({ key }) — rendered
// per block, rate-reconciled). The key is read as the family reads one (util.js keyed): a
// mono key serves every channel. When no key is given the bus has no channels (or a host
// that feeds only bus 0 leaves it undefined) and this keys off the main signal itself
// (self-compression, not true ducking).
// The follower reads the key; the curve's gain is applied with nothing behind it. So
// threshold, ratio, knee and range each set the gain at once: each is smoothed (20 ms)
// and glided sample by sample (util.js glide), so a host's ramp of it is one line,
// however the host cut its calls. While none moves they are k's, and the kernel runs as
// it ran.

import { duckBlock } from './ducker.js'
import { timeCoef, keyed, glide, GLIDE } from './util.js'

export const ducker = (ctx) => {
	const sr = ctx.sampleRate, M = ctx.maxBlockSize, st = [], ring = new Float32Array(0), k = new Float64Array(7), at = new Float64Array(2).fill(NaN)
	const g = new Float64Array(4 * GLIDE).fill(NaN), lanes = new Float64Array(4 * M)
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) st.push(new Float64Array(3))
	return (inputs, outputs, params) => {
		const main = inputs[0], side = inputs[1], out = outputs[0]
		if (!main || !main.length) return
		const a = params.attack[0], r = params.release[0], n = main[0].length
		k[0] = params.threshold[0]; k[1] = params.ratio[0]; k[2] = params.knee[0]; k[3] = params.range[0]
		const moving = glide(g, 0, params.threshold, lanes, 0, n, 0) | glide(g, 1, params.ratio, lanes, M, n, 0) | glide(g, 2, params.knee, lanes, 2 * M, n, 0) | glide(g, 3, params.range, lanes, 3 * M, n, 0)
		if (a !== at[0]) { at[0] = a; k[4] = timeCoef(a, sr) }
		if (r !== at[1]) { at[1] = r; k[5] = timeCoef(r, sr) }
		for (let c = 0; c < main.length; c++) duckBlock(main[c], keyed(side, main, c), out[c], st[c], ring, k, moving ? lanes : undefined, M)
	}
}
ducker.channels = { inputs: [{ channels: 'any' }, { channels: 'any', name: 'key' }], outputs: 'any' }
ducker.tail = 0
ducker.params = {
	threshold: { type: 'number', min: -60, max: 0, default: -30, smoothing: 0.02, unit: 'dB' },
	ratio:     { type: 'number', min: 1, max: 20, default: 4, smoothing: 0.02 },
	knee:      { type: 'number', min: 0, max: 24, default: 6, unit: 'dB', smoothing: 0.02 },
	range:     { type: 'number', min: -90, max: 0, default: -24, unit: 'dB', smoothing: 0.02 },
	attack:    { type: 'number', min: 0.1, max: 200, default: 20, unit: 'ms' },
	release:   { type: 'number', min: 1, max: 2000, default: 300, unit: 'ms' },
}
