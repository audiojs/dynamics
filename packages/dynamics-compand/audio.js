// atom manifest — wraps the SoX-style compand kernel per @audio/compile CONTRACT.
// The kernel's transfer curve is an arbitrary array of [inDb, outDb] points — arrays
// aren't a valid CONTRACT param type (number/enum/bool only). Scalarized: the input
// breakpoints stay fixed at the kernel's own default shape (-90/-60/-20/0 dB) and the
// four output levels become restart-flagged number params, assembled into a `points`
// array only at construction (stream-per-channel style, like the gate pilot).

import { compandStream } from './compand.js'

const IN_DB = [-90, -60, -20, 0]

export const compand = (ctx) => {
	const streams = []
	const opts = {
		sampleRate: ctx.sampleRate,
		points: IN_DB.map((inDb, i) => [inDb, ctx.params[`out${i}`][0]]),
		attack: ctx.params.attack[0],
		release: ctx.params.release[0],
	}
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) streams.push(compandStream(opts))
	return (inputs, outputs) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		for (let c = 0; c < inp.length; c++) out[c].set(streams[c].write(inp[c]))
	}
}
compand.channels = 'any'
compand.tail = 0
compand.params = {
	out0:    { type: 'number', min: -90, max: 0, default: -90, unit: 'dB', flags: ['restart'] },
	out1:    { type: 'number', min: -90, max: 0, default: -60, unit: 'dB', flags: ['restart'] },
	out2:    { type: 'number', min: -90, max: 0, default: -20, unit: 'dB', flags: ['restart'] },
	out3:    { type: 'number', min: -90, max: 0, default: -8, unit: 'dB', flags: ['restart'] },
	attack:  { type: 'number', min: 0.1, max: 200, default: 5, unit: 'ms', flags: ['restart'] },
	release: { type: 'number', min: 1, max: 2000, default: 200, unit: 'ms', flags: ['restart'] },
}
