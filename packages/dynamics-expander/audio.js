// atom manifest — wraps the dynamics expander kernel per @audio/compile CONTRACT.
// Mirrors the compressor pilot: expanderGain is a pure per-sample gain curve just like
// compressorGain, so threshold/ratio/knee/range stay live; only attack/release seed the
// envelope follower at construction (flags: restart).

import { envelope } from '@audio/dynamics-envelope'
import { expanderGain } from './expander.js'
import { db2lin, lin2db } from './util.js'

export const expander = (ctx) => {
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
		const knee = params.knee[0], range = params.range[0]
		for (let c = 0; c < inp.length; c++) {
			const x = inp[c], y = out[c], env = envs[c]
			for (let i = 0; i < x.length; i++) {
				const rDb = expanderGain(lin2db(env(x[i])), threshold, ratio, knee, range)
				y[i] = x[i] * db2lin(rDb)
			}
		}
	}
}
expander.channels = 'any'
expander.tail = 0
expander.params = {
	threshold: { type: 'number', min: -80, max: 0, default: -30, smoothing: 0.01, unit: 'dB' },
	ratio:     { type: 'number', min: 1, max: 20, default: 2 },
	knee:      { type: 'number', min: 0, max: 24, default: 6, unit: 'dB' },
	range:     { type: 'number', min: -90, max: 0, default: -40, unit: 'dB' },
	attack:    { type: 'number', min: 0.1, max: 100, default: 5, unit: 'ms', flags: ['restart'] },
	release:   { type: 'number', min: 1, max: 1000, default: 50, unit: 'ms', flags: ['restart'] },
}
