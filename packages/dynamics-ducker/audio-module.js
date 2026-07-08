// audio-module manifest — wraps the external-sidechain ducker kernel per @audio/module
// CONTRACT §channels. The kernel cleanly separates the key input (duckerStream.write(main,
// side) takes two distinct signals), so this declares a genuine two-bus layout: main +
// sidechain in, main out — mirrors the compressor pilot's live-param style (compressorGain
// is a pure per-sample curve, same as compressor.js; only attack/release seed the envelope
// at construction).
//
// NOTE: the audio host only feeds bus 0 today (single-bus process calls) — until it wires
// up multi-bus routing, `inputs[1]` arrives undefined and this falls back to keying off the
// main signal itself (self-compression, not true ducking). The declaration is forward-looking
// and correct per CONTRACT; it just isn't exercised as a real sidechain until the host catches up.

import { envelope } from '@audio/dynamics-envelope'
import { compressorGain } from '@audio/dynamics-compressor'
import { db2lin, lin2db } from '@audio/dynamics-core'

export const ducker = (ctx) => {
	const envs = []
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) envs.push(envelope({
		sampleRate: ctx.sampleRate,
		attack: ctx.params.attack[0],
		release: ctx.params.release[0],
	}))
	return (inputs, outputs, params) => {
		const main = inputs[0], side = inputs[1], out = outputs[0]
		if (!main || !main.length) return
		const threshold = params.threshold[0], ratio = params.ratio[0]
		const knee = params.knee[0], range = params.range[0]
		for (let c = 0; c < main.length; c++) {
			const x = main[c], y = out[c], env = envs[c]
			const key = side && side[c] ? side[c] : x
			for (let i = 0; i < x.length; i++) {
				let rDb = compressorGain(lin2db(env(key[i])), threshold, ratio, knee)
				if (rDb < range) rDb = range
				y[i] = x[i] * db2lin(rDb)
			}
		}
	}
}
ducker.channels = { inputs: [2, 2], outputs: [2] }
ducker.tail = 0
ducker.params = {
	threshold: { type: 'number', min: -60, max: 0, default: -30, smoothing: 0.01, unit: 'dB' },
	ratio:     { type: 'number', min: 1, max: 20, default: 4 },
	knee:      { type: 'number', min: 0, max: 24, default: 6, unit: 'dB' },
	range:     { type: 'number', min: -90, max: 0, default: -24, unit: 'dB' },
	attack:    { type: 'number', min: 0.1, max: 200, default: 20, unit: 'ms', flags: ['restart'] },
	release:   { type: 'number', min: 1, max: 2000, default: 300, unit: 'ms', flags: ['restart'] },
}
