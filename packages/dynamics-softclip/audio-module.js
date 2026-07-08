// audio-module manifest — wraps the softclip waveshaper per @audio/module CONTRACT.
// Stateless per-sample transfer curve; curve/drive/ceiling are live params
// (shaper rebuilt on change — cheap closure).

import { shaper } from './softclip.js'

export const softclip = (ctx) => {
	let shape = null, sig = ''
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		const curve = params.curve, drive = params.drive[0], ceiling = params.ceiling[0]
		const s = `${curve}|${drive}|${ceiling}`
		if (sig !== s) { shape = shaper({ curve, drive, ceiling }); sig = s }
		for (let c = 0; c < inp.length; c++) {
			const x = inp[c], y = out[c]
			for (let i = 0; i < x.length; i++) y[i] = shape(x[i])
		}
	}
}
softclip.channels = 'any'
softclip.params = {
	curve:   { type: 'enum', values: ['tanh', 'atan', 'cubic', 'sin', 'hard'], default: 'tanh' },
	drive:   { type: 'number', min: 0.1, max: 20, default: 1 },
	ceiling: { type: 'number', min: 0.05, max: 1, default: 1 },
}
