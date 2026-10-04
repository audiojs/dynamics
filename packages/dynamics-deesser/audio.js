// atom manifest — wraps the de-esser kernel per @audio/compile CONTRACT.
// The sibilance band's level over the voice body's (dB, so any recording level)
// drives a cut held within `range`; `mode` applies it broadband or as a peaking
// EQ at fc. All params seed the stream at construction (flags: restart).

import { deesserStream } from './deesser.js'

export const deesser = (ctx) => {
	const streams = []
	const opts = {
		sampleRate: ctx.sampleRate,
		mode: ctx.params.mode,
		fc: ctx.params.fc[0],
		Q: ctx.params.Q[0],
		threshold: ctx.params.threshold[0],
		ratio: ctx.params.ratio[0],
		range: ctx.params.range[0],
		knee: ctx.params.knee[0],
		attack: ctx.params.attack[0],
		release: ctx.params.release[0],
	}
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) streams.push(deesserStream(opts))
	return (inputs, outputs) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		for (let c = 0; c < inp.length; c++) out[c].set(streams[c].write(inp[c]))
	}
}
deesser.channels = 'any'
deesser.params = {
	mode:      { type: 'enum', values: ['broadband', 'band'], default: 'broadband', flags: ['restart'] },
	fc:        { type: 'number', min: 2000, max: 16000, default: 6500, unit: 'Hz', flags: ['restart'], alias: 'freq' },
	Q:         { type: 'number', min: 0.3, max: 10, default: 2, flags: ['restart'], alias: 'q' },
	threshold: { type: 'number', min: -12, max: 24, default: 0, unit: 'dB', flags: ['restart'] },
	ratio:     { type: 'number', min: 1, max: 20, default: 4, flags: ['restart'] },
	range:     { type: 'number', min: -24, max: 0, default: -6, unit: 'dB', flags: ['restart'] },
	knee:      { type: 'number', min: 0, max: 24, default: 6, unit: 'dB', flags: ['restart'] },
	attack:    { type: 'number', min: 0.1, max: 100, default: 1, unit: 'ms', flags: ['restart'] },
	release:   { type: 'number', min: 1, max: 1000, default: 15, unit: 'ms', flags: ['restart'] },
}
