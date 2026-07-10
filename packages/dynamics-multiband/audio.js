// atom manifest — multiband compressor (Linkwitz-Riley split + per-band soft-knee
// compression + flat sum; SoX mcompand class). The kernel is batch-shaped (crossover
// and band-compressor state live inside one call) — declared streaming: false: the
// host materializes the whole timeline and calls process once, per channel.
// Scalar form: 3 bands split at low/high, one compressor setting shared by all bands
// (the "one-knob" mastering stage). Per-band settings and N-band splits take array
// arguments — use the kernel via direct import for those.

import multibandFn from './multiband.js'

export const multiband = (ctx) => {
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		const opts = {
			fs: ctx.sampleRate,
			freqs: [params.low[0], params.high[0]],
			bands: {
				threshold: params.threshold[0],
				ratio: params.ratio[0],
				attack: params.attack[0],
				release: params.release[0],
				makeup: params.makeup[0],
			},
		}
		for (let c = 0; c < inp.length; c++) {
			out[c].set(inp[c])
			multibandFn(out[c], opts)
		}
	}
}
multiband.channels = 'any'
multiband.streaming = false
multiband.tail = 0.3
multiband.params = {
	low:       { type: 'number', min: 40, max: 1000, default: 200, unit: 'Hz', curve: 'log' },
	high:      { type: 'number', min: 1000, max: 12000, default: 2000, unit: 'Hz', curve: 'log' },
	threshold: { type: 'number', min: -60, max: 0, default: -24, unit: 'dB' },
	ratio:     { type: 'number', min: 1, max: 20, default: 3 },
	attack:    { type: 'number', min: 0.1, max: 100, default: 5, unit: 'ms' },
	release:   { type: 'number', min: 20, max: 2000, default: 150, unit: 'ms' },
	makeup:    { type: 'number', min: -12, max: 24, default: 0, unit: 'dB' },
}
