// atom manifest — wraps the transient shaper kernel per @audio/compile CONTRACT.
// The kernel is causal (fast/slow envelope, no lookahead): transientBlock, the default
// export's loop, on one channel's level and slow copy in a typed array made here (the
// follower's fixed 1 ms/50 ms/100 ms constants at ctx.sampleRate, so nothing needs
// `restart`); a block allocates nothing. Its gain is 1 + attackGain·transient +
// sustainGain·(1 − transient), with transient from 0 to 1 (the kernel bounds it, so the
// gain stays between 1 + attackGain and 1 + sustainGain).
// attackGain and sustainGain scale the signal with nothing behind them, so each is
// smoothed (20 ms) and glided sample by sample (glide, below): a host's ramp of it is
// one line, however the host cut its calls; while neither moves they are k's, and the
// kernel runs as it ran.

import { transientBlock, transientSet } from './transient-shaper.js'

export const transientShaper = (ctx) => {
	const M = ctx.maxBlockSize, st = [], k = transientSet(new Float64Array(5), ctx.sampleRate)
	const g = new Float64Array(2 * GLIDE).fill(NaN), lanes = new Float64Array(2 * M)
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) st.push(new Float64Array(2))
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		const n = inp[0].length
		k[3] = params.attackGain[0]; k[4] = params.sustainGain[0]
		const moving = glide(g, 0, params.attackGain, lanes, 0, n, 0) | glide(g, 1, params.sustainGain, lanes, M, n, 0)
		for (let c = 0; c < inp.length; c++) transientBlock(inp[c], out[c], st[c], k, moving ? lanes : undefined, M)
	}
}
transientShaper.channels = 'any'
transientShaper.tail = 0
transientShaper.params = {
	attackGain:  { type: 'number', min: -1, max: 2, default: 0, smoothing: 0.02 },
	sustainGain: { type: 'number', min: -1, max: 2, default: 0, smoothing: 0.02 },
}

// A value that scales the signal, glided sample by sample so that a host's steps of it join into one line: the family's
// glide (the packages with a util.js keep their copy there, where its comment says why it plays the host's line 32
// frames late; this package ships no util.js). `g`: the memory, GLIDE slots a value from j·GLIDE (made NaN); `src`: the
// param's array; this call's `n` values go to `row` from `at`, as they are or (`lin` 1) as the gain e^(v·ln10/20) of a
// value in dB. Returns 1 while they move, 0 when every one is the value.
const GLIDE = 69
function glide (g, j, src, row, at, n, lin) {
	let o = j * GLIDE, r = o + 5, v = src[0], was = g[o]
	if (!(was === was)) { g[o] = v; g[o + 1] = 0; g[o + 2] = n; g[o + 3] = 0; g[o + 4] = 0 }
	else if (v !== was || g[o + 3] < 64) {
		let len = g[o + 2], L = len < 32 ? len : 32, w = (g[o + 1] + len) & 63, d = v - was, held = v === was ? Math.min(g[o + 3] + len, 63) : 0
		for (let q = 0; q < L; q++) g[r + ((w - L + q) & 63)] = was + d * q / L
		g[r + w] = v
		g[o] = v; g[o + 1] = w; g[o + 2] = n; g[o + 3] = held; g[o + 4] = 0
		if (held < 32) {
			for (let i = 0; i < n; i++) {
				let u = i < 32 ? g[r + ((w + i - 32) & 63)] : v
				row[at + i] = lin ? Math.exp(u * (Math.LN10 / 20)) : u
			}
			return 1
		}
	} else { g[o + 1] = (g[o + 1] + g[o + 2]) & 63; g[o + 2] = n }
	// held 32 frames: the ring made all of the value once (a move from it reads the line from there), the row filled
	// with it as far as no call since it was held has filled it; from then on a call only moves the ring's position
	if (g[o + 3] < 64) { for (let q = 0; q < 64; q++) g[r + q] = v; g[o + 3] = 64 }
	if (g[o + 4] < n) {
		let u = lin ? Math.exp(v * (Math.LN10 / 20)) : v
		for (let i = 0; i < n; i++) row[at + i] = u
		g[o + 4] = n
	}
	return 0
}
