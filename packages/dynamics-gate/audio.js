// atom manifest — wraps the dynamics gate kernel per @audio/compile CONTRACT.
// The gate state machine (hysteresis, hold, trigger envelope, gain smoothing,
// look-ahead delay line) runs in gateBlock on typed state made here; a block
// allocates nothing. Every param but `lookahead` is live: read each block, the
// gains, the hold and the attack and release coefficients recomputed when their
// value changes, the gate's state kept, so a change is heard from the next sample
// with no jump in the gain. `lookahead` sets the delay line, so the latency: it is
// fixed for an instance (restart). With lookahead > 0 the delay line emits late —
// declared latency lets the host compensate; while it first fills, the block's head
// is silent.
// Input bus 1 is the key (fed by the `key` option): when it carries channels the
// trigger reads them in place of the input (util.js keyed). `link` mixes each channel's
// trigger level toward the loudest channel's (util.js link): every channel's level is
// read before any channel's gain, into rows made here by ctx.maxBlockSize. At link 0
// and no key the kernel runs as gateBlock does, sample for sample.
// `range` is the closed gain, the target the gain moves to at the attack (rising) or the
// release. The attack is the gate's opening speed, 0.1 ms by default: fast so an onset
// passes whole, and an onset masks it. A range raised while the gate is closed has no
// onset to mask it, so the gain stepped there (26.5 dB in one sample on a tone at
// −50 dB, range −60 → −20 dB). So range is smoothed (20 ms) and glided sample by sample
// (util.js glide, the closed gain e^(range·ln10/20) of each sample's range): the target
// moves as the host ramps it, and the gain follows it at the attack (held, it is k's, and
// the kernel runs as it ran). The thresholds stay as they were: a threshold the level
// then crosses opens or closes the gate as an onset or a decay would, at the gate's own
// attack and release.

import { gateLevel, gateGain, gateState } from './gate.js'
import { db2lin, timeCoef, keyed, link, linAt, coefAt, glide, GLIDE } from './util.js'

export const gate = (ctx) => {
	const sr = ctx.sampleRate, st = [], bufs = [], lev = [], ring = new Float32Array(0), k = new Float64Array(9), at = new Float64Array(6).fill(NaN)
	const L = Math.max(0, Math.round(ctx.params.lookahead[0] * 0.001 * sr)), g = new Float64Array(GLIDE).fill(NaN), closed = new Float64Array(ctx.maxBlockSize)
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) { st.push(gateState(db2lin(ctx.params.range[0]))); bufs.push(new Float32Array(L)); lev.push(new Float64Array(ctx.maxBlockSize)) }
	k[6] = timeCoef(0.1, sr); k[7] = timeCoef(5, sr)
	return (inputs, outputs, params) => {
		const inp = inputs[0], key = inputs[1], out = outputs[0]
		if (!inp || !inp.length) return
		const ln = params.link[0], nc = inp.length, n = inp[0].length, th = params.threshold[0], cl = params.closeThreshold[0], rg = params.range[0], hd = params.hold[0], a = params.attack[0], r = params.release[0]
		if (th !== at[0] || cl !== at[1]) { at[0] = th; at[1] = cl; linAt(k, 0, at, 0); k[1] = Math.min(cl, th); linAt(k, 1, k, 1) }
		if (rg !== at[2]) { at[2] = rg; linAt(k, 2, at, 2) }
		if (hd !== at[3]) { at[3] = hd; k[5] = Math.max(0, Math.round(hd * 0.001 * sr)) }
		if (a !== at[4]) { at[4] = a; coefAt(k, 3, at, 4, sr) }
		if (r !== at[5]) { at[5] = r; coefAt(k, 4, at, 5, sr) }
		const ramp = glide(g, 0, params.range, closed, 0, n, 1) ? closed : undefined
		for (let c = 0; c < nc; c++) gateLevel(keyed(key, inp, c), lev[c], st[c], ring, k)
		if (ln > 0 && nc > 1) link(lev, nc, n, params.link)
		for (let c = 0; c < nc; c++) gateGain(inp[c], lev[c], out[c], st[c], bufs[c], k, ramp)
	}
}
gate.channels = { inputs: [{ channels: 'any' }, { channels: 'any', name: 'key' }], outputs: 'any' }
gate.latency = (ctx) => Math.round(ctx.params.lookahead[0] * 0.001 * ctx.sampleRate)
gate.tail = 0
gate.params = {
	threshold:      { type: 'number', min: -80, max: 0, default: -40, unit: 'dB' },
	closeThreshold: { type: 'number', min: -90, max: 0, default: -46, unit: 'dB' },
	range:          { type: 'number', min: -90, max: 0, default: -60, unit: 'dB', smoothing: 0.02 },
	hold:           { type: 'number', min: 0, max: 500, default: 10, unit: 'ms' },
	attack:         { type: 'number', min: 0.01, max: 100, default: 0.1, unit: 'ms' },
	release:        { type: 'number', min: 1, max: 1000, default: 100, unit: 'ms' },
	lookahead:      { type: 'number', min: 0, max: 50, default: 0, unit: 'ms', restart: true },
	link:           { type: 'number', min: 0, max: 1, default: 0, smoothing: 0.01 },
}
