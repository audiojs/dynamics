// atom manifest — wraps the transient shaper kernel per @audio/atom CONTRACT.
// The kernel is causal (fast/slow envelope, no lookahead) and carries its continuation
// state (_envFast/_envSlow) on the options object passed in, mutating it in place. We
// own one such state object per channel in closure (fs fixed at construction; the
// kernel's own fixed 1ms/50ms envelope time constants aren't parameterized, so nothing
// needs `restart`) and refresh attackGain/sustainGain from the live params every block
// before calling the kernel directly on the (copied) output buffer.
//
// KNOWN KERNEL DEFECT (not fixed here — out of scope for a manifest wrapper): the
// kernel's `transient = diff/envSlow` ratio (transient-shaper.js) is unbounded. Right
// after a cold start or a near-silent passage, envSlow sits near zero while envFast
// rises fast, so the ratio — and thus the output gain — can spike to 30-40x for a few
// milliseconds. `attackGain`/`sustainGain` are range-limited to [-1, 2] here to keep
// that spike survivable, but the instability is in the kernel's math, not the range.

import transientShaperCurve from './transient-shaper.js'

export const transientShaper = (ctx) => {
	const states = []
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) states.push({
		fs: ctx.sampleRate,
		attackGain: ctx.params.attackGain[0],
		sustainGain: ctx.params.sustainGain[0],
		_envFast: 0,
		_envSlow: 0,
	})
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		const attackGain = params.attackGain[0], sustainGain = params.sustainGain[0]
		for (let c = 0; c < inp.length; c++) {
			const st = states[c]
			st.attackGain = attackGain
			st.sustainGain = sustainGain
			out[c].set(inp[c])
			transientShaperCurve(out[c], st)
		}
	}
}
transientShaper.channels = 'any'
transientShaper.tail = 0
transientShaper.params = {
	attackGain:  { type: 'number', min: -1, max: 2, default: 0 },
	sustainGain: { type: 'number', min: -1, max: 2, default: 0 },
}
