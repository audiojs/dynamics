// atom manifest — wraps the SoX-style compand kernel per @audio/compile CONTRACT.
// The kernel's transfer curve is an arbitrary array of [inDb, outDb] points — arrays
// aren't a valid CONTRACT param type (number/enum/bool only). Scalarized: the input
// breakpoints stay fixed at the kernel's own default shape (-90/-60/-20/0 dB) and the
// four output levels are number params. Every param is live: the output levels are
// written into the curve each block (each sample while one moves), the follower's
// coefficients recomputed when the attack or release changes, its state kept. State, settings and the curve are typed
// arrays made here; a block allocates nothing.
// An output level sets the gain at its level with nothing behind it (the follower reads
// the input), so each is smoothed (20 ms) and glided sample by sample (util.js glide): a
// host's ramp of it is one line, however the host cut its calls. While none moves the
// curve holds the four values, and the kernel runs as it ran.

import { compandBlock } from './compand.js'
import { timeCoef, glide, GLIDE } from './util.js'

const IN_DB = [-90, -60, -20, 0]

export const compand = (ctx) => {
	const sr = ctx.sampleRate, M = ctx.maxBlockSize, st = [], ring = new Float32Array(0), k = new Float64Array(3), at = new Float64Array(2).fill(NaN)
	const p = Float64Array.from(IN_DB.flatMap(inDb => [inDb, 0])), g = new Float64Array(4 * GLIDE).fill(NaN), outs = new Float64Array(4 * M)
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) st.push(new Float64Array(3))
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		const a = params.attack[0], r = params.release[0], n = inp[0].length
		p[1] = params.out0[0]; p[3] = params.out1[0]; p[5] = params.out2[0]; p[7] = params.out3[0]
		const moving = glide(g, 0, params.out0, outs, 0, n, 0) | glide(g, 1, params.out1, outs, M, n, 0) | glide(g, 2, params.out2, outs, 2 * M, n, 0) | glide(g, 3, params.out3, outs, 3 * M, n, 0)
		if (a !== at[0]) { at[0] = a; k[0] = timeCoef(a, sr) }
		if (r !== at[1]) { at[1] = r; k[1] = timeCoef(r, sr) }
		for (let c = 0; c < inp.length; c++) compandBlock(inp[c], out[c], st[c], ring, k, p, moving ? outs : undefined, M)
	}
}
compand.channels = 'any'
compand.tail = 0
compand.params = {
	out0:    { type: 'number', min: -90, max: 0, default: -90, unit: 'dB', smoothing: 0.02 },
	out1:    { type: 'number', min: -90, max: 0, default: -60, unit: 'dB', smoothing: 0.02 },
	out2:    { type: 'number', min: -90, max: 0, default: -20, unit: 'dB', smoothing: 0.02 },
	out3:    { type: 'number', min: -90, max: 0, default: -8, unit: 'dB', smoothing: 0.02 },
	attack:  { type: 'number', min: 0.1, max: 200, default: 5, unit: 'ms' },
	release: { type: 'number', min: 1, max: 2000, default: 200, unit: 'ms' },
}
