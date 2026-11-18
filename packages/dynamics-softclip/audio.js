// atom manifest — wraps the softclip waveshaper per @audio/compile CONTRACT.
// It streams: softclipBlock shapes each sample as it comes, or (oversample > 1) its N
// points through the same Lanczos kernels the whole-buffer call resamples with, read from
// rings carried from call to call. Those kernels reach 16 samples ahead, so oversampling
// delays the output by 15 + ⌈17/N⌉ samples (declared latency); `oversample` sets that
// delay and the kernels, so it is fixed for an instance (restart). curve, drive and
// ceiling are live, read each block. State is typed arrays made here; a block allocates
// nothing. oversample: 1 is the curve alone, sample for sample, with no delay.
// drive and ceiling scale the curve with nothing behind them (it has no state), so each
// is smoothed (20 ms) and glided sample by sample (util.js glide): a host's ramp of it is
// one line, however the host cut its calls; while neither moves they are k's, and the
// kernel runs as it ran. The curve is a choice: it switches at once.

import { softclipBlock, softclipState, oversampler, CURVES } from './softclip.js'
import { glide, GLIDE } from './util.js'

export const softclip = (ctx) => {
	const N = Math.round(ctx.params.oversample[0]), os = N > 1 ? oversampler(N) : null, st = [], k = new Float64Array(4), M = ctx.maxBlockSize
	const g = new Float64Array(2 * GLIDE).fill(NaN), lanes = new Float64Array(2 * M)
	for (let c = 0, C = ctx.maxChannels ?? 8; c < C; c++) st.push(softclipState())
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		const n = inp[0].length, dr = params.drive[0]
		k[0] = CURVES.indexOf(params.curve); k[1] = dr; k[2] = params.ceiling[0]; k[3] = Math.PI * dr / 2
		const moving = glide(g, 0, params.drive, lanes, 0, n, 0) | glide(g, 1, params.ceiling, lanes, M, n, 0)
		for (let c = 0; c < inp.length; c++) softclipBlock(inp[c], out[c], k, os, st[c], moving ? lanes : undefined, M)
	}
}
softclip.channels = 'any'
softclip.latency = (ctx) => { const N = Math.round(ctx.params.oversample[0]); return N > 1 ? 15 + Math.ceil(17 / N) : 0 }
softclip.params = {
	curve:      { type: 'enum', values: ['tanh', 'atan', 'cubic', 'sin', 'hard'], default: 'tanh' },
	drive:      { type: 'number', min: 0.1, max: 20, default: 1, smoothing: 0.02 },
	ceiling:    { type: 'number', min: 0.05, max: 1, default: 1, smoothing: 0.02 },
	oversample: { type: 'number', min: 1, max: 8, default: 1, step: 1, restart: true },
}
