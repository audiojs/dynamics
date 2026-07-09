// atom manifest — wraps the dynamics compressor kernel per @audio/atom CONTRACT.
// attack/release seed the envelope at construction (flags: restart); the rest are live.

import { envelope } from '@audio/dynamics-envelope'
import { compressorGain } from './compressor.js'
import { db2lin, lin2db } from '@audio/dynamics-core'

export const compressor = (ctx) => {
	const envs = []
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) envs.push(envelope({
		sampleRate: ctx.sampleRate,
		attack: ctx.params.attack[0],
		release: ctx.params.release[0],
	}))
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		const threshold = params.threshold[0], ratio = params.ratio[0]
		const knee = params.knee[0], makeup = params.makeup[0]
		for (let c = 0; c < inp.length; c++) {
			const x = inp[c], y = out[c], env = envs[c]
			for (let i = 0; i < x.length; i++) {
				const rDb = compressorGain(lin2db(env(x[i])), threshold, ratio, knee)
				y[i] = x[i] * db2lin(rDb + makeup)
			}
		}
	}
}
compressor.channels = 'any'
compressor.tail = 0.3
compressor.params = {
	threshold: { type: 'number', min: -60, max: 0, default: -20, smoothing: 0.01, unit: 'dB' },
	ratio:     { type: 'number', min: 1, max: 20, default: 4 },
	knee:      { type: 'number', min: 0, max: 24, default: 6, unit: 'dB' },
	makeup:    { type: 'number', min: -12, max: 24, default: 0, unit: 'dB' },
	attack:    { type: 'number', min: 0.1, max: 100, default: 5, unit: 'ms', flags: ['restart'] },
	release:   { type: 'number', min: 1, max: 1000, default: 100, unit: 'ms', flags: ['restart'] },
}
