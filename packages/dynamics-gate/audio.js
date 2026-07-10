// atom manifest — wraps the dynamics gate kernel per @audio/compile CONTRACT.
// The gate state machine (hysteresis, hold, trigger envelope, gain smoothing,
// look-ahead delay line) lives in gateStream; all params seed it at construction
// (flags: restart). With lookahead > 0 the delay line emits late — declared
// latency lets the host compensate (limiter pattern: short emissions during
// delay-line fill land at the block tail).

import { gateStream } from './gate.js'

export const gate = (ctx) => {
	const streams = []
	const opts = {
		sampleRate: ctx.sampleRate,
		threshold: ctx.params.threshold[0],
		closeThreshold: ctx.params.closeThreshold[0],
		range: ctx.params.range[0],
		hold: ctx.params.hold[0],
		attack: ctx.params.attack[0],
		release: ctx.params.release[0],
		lookahead: ctx.params.lookahead[0],
	}
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) streams.push(gateStream(opts))
	return (inputs, outputs) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		for (let c = 0; c < inp.length; c++) {
			const w = streams[c].write(inp[c]), y = out[c]
			if (w.length === y.length) y.set(w)
			else { y.fill(0, 0, y.length - w.length); y.set(w, y.length - w.length) }
		}
	}
}
gate.channels = 'any'
gate.latency = (ctx) => Math.round(ctx.params.lookahead[0] * 0.001 * ctx.sampleRate)
gate.tail = 0
gate.params = {
	threshold:      { type: 'number', min: -80, max: 0, default: -40, unit: 'dB', flags: ['restart'] },
	closeThreshold: { type: 'number', min: -90, max: 0, default: -46, unit: 'dB', flags: ['restart'] },
	range:          { type: 'number', min: -90, max: 0, default: -60, unit: 'dB', flags: ['restart'] },
	hold:           { type: 'number', min: 0, max: 500, default: 10, unit: 'ms', flags: ['restart'] },
	attack:         { type: 'number', min: 0.01, max: 100, default: 0.1, unit: 'ms', flags: ['restart'] },
	release:        { type: 'number', min: 1, max: 1000, default: 100, unit: 'ms', flags: ['restart'] },
	lookahead:      { type: 'number', min: 0, max: 50, default: 0, unit: 'ms', flags: ['restart'] },
}
