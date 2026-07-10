// atom manifest — vari-mu compressor (Fairchild class: feedback topology, very soft
// wide knee, slow attack, ratio grows with drive). Per-channel streaming writer;
// params bake at construction — flags:['restart'].

import { varimuStream } from './varimu.js'

export const varimu = (ctx) => {
	const chans = []
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) chans.push(varimuStream({
		sampleRate: ctx.sampleRate,
		threshold: ctx.params.threshold[0],
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
varimu.channels = 'any'
varimu.tail = 0.5
varimu.params = {
	threshold: { type: 'number', min: -60, max: 0, default: -22, unit: 'dB', flags: ['restart'] },
	knee:      { type: 'number', min: 6, max: 30, default: 15, unit: 'dB', flags: ['restart'] },
	attack:    { type: 'number', min: 5, max: 200, default: 25, unit: 'ms', flags: ['restart'] },
	release:   { type: 'number', min: 50, max: 2000, default: 400, unit: 'ms', flags: ['restart'] },
	makeup:    { type: 'number', min: -12, max: 24, default: 0, unit: 'dB', flags: ['restart'] },
}
