// atom manifest — wraps the de-esser kernel per @audio/compile CONTRACT.
// The sibilance band's level over the voice body's (dB, so any recording level)
// drives a cut held within `range`; `mode` applies it to the band over `split`
// (linear phase), to a band at fc, Q, or broadband. Each block comes out whole,
// `lookahead` ms late (declared latency): `lookahead` sets the delay, so it is fixed
// for an instance (restart). Every other param is live: read each block; the band and
// the detector's filters retuned when mode, split, fc or Q move the band's edges, the
// smoother's coefficients when attack or release changes; filter and smoother states
// kept. State, settings and the band are typed arrays made here; a block allocates
// nothing. Tail: the linear-phase band reads 1.5 ms past the delayed sample.

import { deessBlock, deesserSet, deesserState, deesserBand, latency, tail } from './deesser.js'
import { timeCoef } from './util.js'

export const deesser = (ctx) => {
	const sr = ctx.sampleRate, L = latency(sr, ctx.params.lookahead[0]), set = deesserSet(sr), k = set.k, st = [], bufs = []
	const at = new Float64Array(2).fill(NaN), band = new Float64Array(3).fill(NaN)
	let mode = null
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) { st.push(deesserState()); bufs.push(new Float64Array(L + (set.h.length >> 1) + 1)) }
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		const a = params.attack[0], r = params.release[0], sp = params.split[0], f = params.fc[0], q = params.Q[0]
		k[0] = params.threshold[0]; k[1] = params.ratio[0]; k[2] = params.knee[0]; k[3] = Math.abs(params.range[0])
		if (a !== at[0]) { at[0] = a; k[4] = timeCoef(a, sr) }
		if (r !== at[1]) { at[1] = r; k[5] = timeCoef(r, sr) }
		if (params.mode !== mode || sp !== band[0] || f !== band[1] || q !== band[2]) { mode = params.mode; band[0] = sp; band[1] = f; band[2] = q; deesserBand(set, mode, band) }
		for (let c = 0; c < inp.length; c++) deessBlock(inp[c], out[c], st[c], bufs[c], set)
	}
}
deesser.channels = 'any'
deesser.latency = (ctx) => latency(ctx.sampleRate, ctx.params.lookahead[0])
deesser.tail = (at) => tail(at.sampleRate, at.params.mode)
deesser.params = {
	mode:      { type: 'enum', values: ['split', 'band', 'broadband'], default: 'split' },
	split:     { type: 'number', min: 1000, max: 16000, default: 3500, unit: 'Hz' },
	fc:        { type: 'number', min: 2000, max: 16000, default: 6500, unit: 'Hz', alias: 'freq' },
	Q:         { type: 'number', min: 0.3, max: 10, default: 1.4, alias: 'q' },
	threshold: { type: 'number', min: -12, max: 24, default: 0, unit: 'dB' },
	ratio:     { type: 'number', min: 1, max: 20, default: 4 },
	range:     { type: 'number', min: -24, max: 0, default: -8, unit: 'dB' },
	knee:      { type: 'number', min: 0, max: 24, default: 6, unit: 'dB' },
	attack:    { type: 'number', min: 0.1, max: 100, default: 1, unit: 'ms' },
	release:   { type: 'number', min: 1, max: 1000, default: 15, unit: 'ms' },
	lookahead: { type: 'number', min: 0, max: 20, default: 5, unit: 'ms', restart: true },
}
