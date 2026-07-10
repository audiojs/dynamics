// atom manifest — wraps the softclip waveshaper per @audio/compile CONTRACT.
// streaming: false — oversample > 1 needs whole-signal context for the sinc
// resample round-trip (per-block oversampling would seam at block edges);
// family precedent (@audio/saturate-waveshaper, @audio/dynamics-multiband).
// oversample: 1 is mathematically per-sample regardless of block size, so this
// only costs host-side buffering for the (default) non-oversampled case.

import { shaper } from './softclip.js'
import { shape } from './shape.js'

export const softclip = (ctx) => (inputs, outputs, params) => {
	const inp = inputs[0], out = outputs[0]
	if (!inp || !inp.length) return
	const fn = shaper({ curve: params.curve, drive: params.drive[0], ceiling: params.ceiling[0] })
	const oversample = params.oversample[0]
	for (let c = 0; c < inp.length; c++)
		out[c].set(shape(inp[c], fn, { fs: ctx.sampleRate, oversample }))
}
softclip.channels = 'any'
softclip.streaming = false
softclip.params = {
	curve:      { type: 'enum', values: ['tanh', 'atan', 'cubic', 'sin', 'hard'], default: 'tanh' },
	drive:      { type: 'number', min: 0.1, max: 20, default: 1 },
	ceiling:    { type: 'number', min: 0.05, max: 1, default: 1 },
	oversample: { type: 'number', min: 1, max: 8, default: 1, step: 1 },
}
