// atom manifest — optical compressor (LA-2A class: RMS detection, wide soft knee,
// ~3:1, T4 program-dependent release that slows the longer reduction persists).
// Per-channel streaming writer; params bake at construction — flags:['restart'].

import { optoStream } from './opto.js'

export const opto = (ctx) => {
	const chans = []
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) chans.push(optoStream({
		sampleRate: ctx.sampleRate,
		threshold: ctx.params.threshold[0],
		ratio: ctx.params.ratio[0],
		knee: ctx.params.knee[0],
		attack: ctx.params.attack[0],
		makeup: ctx.params.makeup[0],
	}))
	return (inputs, outputs) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		for (let c = 0; c < inp.length; c++) out[c].set(chans[c].write(inp[c]))
	}
}
opto.channels = 'any'
opto.tail = 1  // T4 memory cell integrates ~3 s of reduction history; release rides it
opto.params = {
	threshold: { type: 'number', min: -60, max: 0, default: -20, unit: 'dB', flags: ['restart'] },
	ratio:     { type: 'number', min: 1.5, max: 6, default: 3, flags: ['restart'] },
	knee:      { type: 'number', min: 4, max: 24, default: 10, unit: 'dB', flags: ['restart'] },
	attack:    { type: 'number', min: 1, max: 100, default: 10, unit: 'ms', flags: ['restart'] },
	makeup:    { type: 'number', min: -12, max: 24, default: 0, unit: 'dB', flags: ['restart'] },
}
