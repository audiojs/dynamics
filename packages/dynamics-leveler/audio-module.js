// audio-module manifest — wraps the dynaudnorm-style frame leveler per @audio/module CONTRACT.
// The kernel is genuinely non-causal, not merely lookahead-delayed: its gaussian
// smoothing window looks both back AND forward across frames (±`smooth` frames), and
// frame count/gain envelope are derived from the FULL signal length up front — there
// is no bounded per-instance delay to declare as `latency`, and no streaming variant
// of the kernel exists to wrap chunk-by-chunk. Declared streaming: false instead; the
// host buffers the whole input and calls process once with frames = totalFrames, which
// is exactly the batch shape `leveler(data, opts)` already expects.

import levelerCurve from './leveler.js'

export const leveler = (ctx) => {
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		const opts = {
			fs: ctx.sampleRate,
			target: params.target[0],
			frame: params.frame[0],
			maxGain: params.maxGain[0],
			smooth: Math.round(params.smooth[0]),
		}
		for (let c = 0; c < inp.length; c++) {
			out[c].set(inp[c])
			levelerCurve(out[c], opts)
		}
	}
}
leveler.channels = 'any'
leveler.streaming = false
leveler.tail = 0
leveler.params = {
	target:  { type: 'number', min: -40, max: 0, default: -20, unit: 'dB' },
	frame:   { type: 'number', min: 0.05, max: 5, default: 0.5, unit: 's' },
	maxGain: { type: 'number', min: 0, max: 30, default: 12, unit: 'dB' },
	smooth:  { type: 'number', min: 0, max: 30, default: 5 },
}
