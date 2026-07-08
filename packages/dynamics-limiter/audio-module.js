// audio-module manifest — wraps the lookahead brickwall limiter per @audio/module CONTRACT.
// The delay line emits `lookahead` late; declared latency lets the host compensate
// (audio's plan engine runs cursors ahead, so output lands timeline-aligned).
// Emissions may run short during delay-line fill — they land at the block tail.

import { limiterStream } from './limiter.js'

export const limiter = (ctx) => {
	const streams = []
	const opts = {
		sampleRate: ctx.sampleRate,
		ceiling: ctx.params.ceiling[0],
		lookahead: ctx.params.lookahead[0],
		release: ctx.params.release[0],
	}
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) streams.push(limiterStream(opts))
	return (inputs, outputs) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		for (let c = 0; c < inp.length; c++) {
			const w = streams[c].write(inp[c]), y = out[c]
			y.fill(0, 0, y.length - w.length)
			y.set(w, y.length - w.length)
		}
	}
}
limiter.channels = 'any'
limiter.latency = (ctx) => Math.round(ctx.params.lookahead[0] * 0.001 * ctx.sampleRate)
limiter.params = {
	ceiling:   { type: 'number', min: -30, max: 0, default: -0.3, unit: 'dB', flags: ['restart'] },
	lookahead: { type: 'number', min: 0.1, max: 20, default: 5, unit: 'ms', flags: ['restart'] },
	release:   { type: 'number', min: 1, max: 1000, default: 50, unit: 'ms', flags: ['restart'] },
}
