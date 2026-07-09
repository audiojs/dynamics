// atom manifest — FET compressor (1176 class: very fast peak detection, high ratios,
// firm knee). The kernel is a per-channel streaming writer whose params bake into the
// envelope/coefficients at construction — all params carry flags:['restart'].

import { fetStream } from './fet.js'

export const fet = (ctx) => {
	const chans = []
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) chans.push(fetStream({
		sampleRate: ctx.sampleRate,
		threshold: ctx.params.threshold[0],
		ratio: ctx.params.ratio[0],
		knee: ctx.params.knee[0],
		attack: ctx.params.attack[0],
		release: ctx.params.release[0],
		makeup: ctx.params.makeup[0],
	}))
	return (inputs, outputs) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		for (let c = 0; c < inp.length; c++) out[c].set(chans[c].write(inp[c]))
	}
}
fet.channels = 'any'
fet.tail = 0.3
fet.params = {
	threshold: { type: 'number', min: -60, max: 0, default: -18, unit: 'dB', flags: ['restart'] },
	ratio:     { type: 'number', min: 4, max: 20, default: 8, flags: ['restart'] },
	knee:      { type: 'number', min: 0, max: 12, default: 3, unit: 'dB', flags: ['restart'] },
	attack:    { type: 'number', min: 0.02, max: 5, default: 0.2, unit: 'ms', flags: ['restart'] },
	release:   { type: 'number', min: 20, max: 1000, default: 120, unit: 'ms', flags: ['restart'] },
	makeup:    { type: 'number', min: -12, max: 24, default: 0, unit: 'dB', flags: ['restart'] },
}
