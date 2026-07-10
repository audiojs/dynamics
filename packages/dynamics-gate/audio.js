// atom manifest — wraps the dynamics gate kernel per @audio/compile CONTRACT.
// The gate state machine (hold, trigger envelope, gain smoothing) lives in gateStream;
// all params seed it at construction (flags: restart).

import { gateStream } from './gate.js'

export const gate = (ctx) => {
	const streams = []
	const opts = {
		sampleRate: ctx.sampleRate,
		threshold: ctx.params.threshold[0],
		range: ctx.params.range[0],
		hold: ctx.params.hold[0],
		attack: ctx.params.attack[0],
		release: ctx.params.release[0],
	}
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) streams.push(gateStream(opts))
	return (inputs, outputs) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		for (let c = 0; c < inp.length; c++) out[c].set(streams[c].write(inp[c]))
	}
}
gate.channels = 'any'
gate.tail = 0
gate.params = {
	threshold: { type: 'number', min: -80, max: 0, default: -40, unit: 'dB', flags: ['restart'] },
	range:     { type: 'number', min: -90, max: 0, default: -60, unit: 'dB', flags: ['restart'] },
	hold:      { type: 'number', min: 0, max: 500, default: 10, unit: 'ms', flags: ['restart'] },
	attack:    { type: 'number', min: 0.01, max: 100, default: 0.1, unit: 'ms', flags: ['restart'] },
	release:   { type: 'number', min: 1, max: 1000, default: 100, unit: 'ms', flags: ['restart'] },
}
