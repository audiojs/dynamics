// atom manifest — wraps the de-limiter kernel per @audio/compile CONTRACT.
// Runs unlimit.js's unlimitBlock, unlimitStream's loop, per channel: fast/slow envelope
// pair feeds the transient detector; deficit mode (adaptive, default) evaluates the
// transient DEFICIT against crestTarget through three gates — peak hold (~150 dB/s
// release), 10 ms attack window after a fresh peak, ~3 ms confirmation ramp — see
// unlimit.js's header for why each exists; a third envelope matching the fast
// ballistics smooths the target lift so curve corners don't zipper. adaptive: false
// = legacy proportional transient-following (transient exaggerator).
// Every param is live: read each block, the followers' coefficients recomputed when
// their attack or release changes, their state kept. State and settings are typed
// arrays made here; a block allocates nothing.
//
// `ceiling`'s params-convention default has no null to switch off with (kernel default:
// null = off, peaks may exceed 0 dBFS by design). Same substitution the compressor
// manifest uses for upThreshold: pin the default above the maximum any signal can
// reach through this atom — amount's declared max is 18 dB, so a ceiling default of
// 24 dB can never engage for a ≤0 dBFS input, a mathematical no-op standing in for "off".
// amount, drive and crestTarget set the lift's target, which the smoothing follower
// follows at the fast ballistics. The ceiling clamps the output with nothing behind it,
// so it is smoothed (20 ms) and glided sample by sample (util.js glide, the linear
// ceiling e^(ceiling·ln10/20) of each sample's): a host's ramp of it is one line,
// however the host cut its calls. Held, it is k's, and the kernel runs as it ran.

import { unlimitBlock, unlimitState } from './unlimit.js'
import { db2lin, timeCoef, glide, GLIDE } from './util.js'

export const unlimit = (ctx) => {
	const sr = ctx.sampleRate, st = [], k = new Float64Array(12), at = new Float64Array(4).fill(NaN)
	const g = new Float64Array(GLIDE).fill(NaN), ceil = new Float64Array(ctx.maxBlockSize)
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) st.push(unlimitState())
	k[9] = 150 / sr; k[10] = 1 / (0.003 * sr); k[11] = Math.round(0.010 * sr)
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		const fa = params.fastAttack[0], fr = params.fastRelease[0], sa = params.slowAttack[0], sl = params.slowRelease[0]
		k[0] = params.amount[0]; k[1] = params.drive[0]; k[2] = params.adaptive ? 1 : 0; k[3] = params.crestTarget[0]
		k[4] = db2lin(params.ceiling[0])
		if (fa !== at[0]) { at[0] = fa; k[5] = timeCoef(fa, sr) }
		if (fr !== at[1]) { at[1] = fr; k[6] = timeCoef(fr, sr) }
		if (sa !== at[2]) { at[2] = sa; k[7] = timeCoef(sa, sr) }
		if (sl !== at[3]) { at[3] = sl; k[8] = timeCoef(sl, sr) }
		const ramp = glide(g, 0, params.ceiling, ceil, 0, inp[0].length, 1) ? ceil : undefined
		for (let c = 0; c < inp.length; c++) unlimitBlock(inp[c], out[c], st[c], k, ramp)
	}
}
unlimit.channels = 'any'
unlimit.tail = 0
unlimit.params = {
	amount:      { type: 'number', min: 0, max: 18, default: 6, unit: 'dB' },
	drive:       { type: 'number', min: 0, max: 10, default: 1 },
	adaptive:    { type: 'bool', default: true },
	crestTarget: { type: 'number', min: 3, max: 25, default: 10, unit: 'dB' },
	ceiling:     { type: 'number', min: -60, max: 24, default: 24, unit: 'dB', smoothing: 0.02 },
	fastAttack:  { type: 'number', min: 0.1, max: 10, default: 0.5, unit: 'ms' },
	fastRelease: { type: 'number', min: 1, max: 100, default: 20, unit: 'ms' },
	slowAttack:  { type: 'number', min: 1, max: 200, default: 20, unit: 'ms' },
	slowRelease: { type: 'number', min: 10, max: 1000, default: 200, unit: 'ms' },
}
