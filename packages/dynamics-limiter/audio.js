// atom manifest — wraps the lookahead brickwall limiter per @audio/compile CONTRACT.
// The delay line emits `lookahead` late (and the true-peak kernel's 96 samples); declared latency lets the host compensate
// (audio's plan engine runs cursors ahead, so output lands timeline-aligned). While the line first fills, the block's
// head is silent. `lookahead` and `truePeak` set the delay, so the latency: they are fixed for an instance (restart).
// `ceiling` and `release` are live, read each block (recomputed when their value changes), the line's state kept: a new
// ceiling holds the samples that enter from then on; the ones already in the line had their gain ramped for the ceiling
// they entered under. Each channel's line is limiterLine on typed state made here; a block allocates nothing.
// `link` mixes each channel's peak toward the loudest channel's (util.js link): every channel's peaks are read before
// any channel's gain, into rows made here by ctx.maxBlockSize; at 1 every channel takes one gain. Each channel still
// holds its own ceiling: the peak its gain reads is never under its own (a true peak the reader leaves unread is under
// the ceiling, and a gain of 1 or less keeps it there). No key: a limiter holds the ceiling of what it reads. At link 0
// the kernel runs as limiterLine's run does, sample for sample.

import { limiterLine, latency } from './limiter.js'
import { link, linAt, coefAt } from './util.js'

export const limiter = (ctx) => {
	const sr = ctx.sampleRate, lines = [], lev = [], set = new Float64Array(2), at = new Float64Array(2).fill(NaN)
	const opts = { sampleRate: sr, lookahead: ctx.params.lookahead[0], truePeak: ctx.params.truePeak }
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) { lines.push(limiterLine(opts, set)); lev.push(new Float64Array(ctx.maxBlockSize)) }
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		const ce = params.ceiling[0], r = params.release[0], ln = params.link[0], nc = inp.length
		if (ce !== at[0]) { at[0] = ce; linAt(set, 0, at, 0) }
		if (r !== at[1]) { at[1] = r; coefAt(set, 1, at, 1, sr) }
		for (let c = 0; c < nc; c++) lines[c].level(inp[c], lev[c])
		if (ln > 0 && nc > 1) link(lev, nc, inp[0].length, params.link)
		for (let c = 0; c < nc; c++) lines[c].apply(inp[c], lev[c], out[c])
	}
}
limiter.channels = 'any'
limiter.latency = (ctx) => latency({ lookahead: ctx.params.lookahead[0], sampleRate: ctx.sampleRate, truePeak: ctx.params.truePeak })
limiter.params = {
	ceiling:   { type: 'number', min: -30, max: 0, default: -0.3, unit: 'dB' },
	lookahead: { type: 'number', min: 0.1, max: 20, default: 5, unit: 'ms', restart: true },
	release:   { type: 'number', min: 1, max: 1000, default: 50, unit: 'ms' },
	truePeak:  { type: 'bool', default: false, restart: true },
	link:      { type: 'number', min: 0, max: 1, default: 0, smoothing: 0.01 },
}
