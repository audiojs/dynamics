// atom manifest — VCA compressor (dbx/SSL-bus class: clean feed-forward peak
// detection, near-hard knee, dB-linear gain). Per-channel streaming writer;
// params bake at construction — flags:['restart'].

import { vcaStream } from './vca.js'

export const vca = (ctx) => {
	const chans = []
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) chans.push(vcaStream({
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
vca.channels = 'any'
vca.tail = 0.3
vca.params = {
	threshold: { type: 'number', min: -60, max: 0, default: -20, unit: 'dB', flags: ['restart'] },
	ratio:     { type: 'number', min: 1, max: 20, default: 4, flags: ['restart'] },
	knee:      { type: 'number', min: 0, max: 12, default: 1, unit: 'dB', flags: ['restart'] },
	attack:    { type: 'number', min: 0.1, max: 100, default: 1, unit: 'ms', flags: ['restart'] },
	release:   { type: 'number', min: 20, max: 2000, default: 150, unit: 'ms', flags: ['restart'] },
	makeup:    { type: 'number', min: -12, max: 24, default: 0, unit: 'dB', flags: ['restart'] },
}
