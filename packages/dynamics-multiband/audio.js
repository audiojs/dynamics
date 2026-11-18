// atom manifest — multiband compressor (Linkwitz-Riley split + per-band soft-knee
// compression + flat sum; SoX mcompand class). It streams: multibandBlock carries each
// channel's crossover and band-follower state from call to call, in typed arrays made
// here; a block allocates nothing. Every param is live, read each block: the crossovers'
// coefficients recomputed in place (split3) when `low` or `high` changes, the followers'
// attack and release coefficients when theirs do, the filters' and followers' state kept.
// The crossovers are causal IIR filters: no latency; the tail is their ring (tail()).
// Scalar form: 3 bands split at low/high, one compressor setting shared by all bands
// (the "one-knob" mastering stage). Per-band settings and N-band splits take array
// arguments — use the kernel via direct import for those (see README's OTT recipe).
// upThreshold/upRatio add upward (below-threshold lift) compression alongside the
// existing downward curve, as @audio/dynamics-compressor 0.2's per-band call does.
// depth scales the summed up+down gain (OTT's "Depth" macro); upRatio defaults to 1
// (no-op), matching the compressor atom's own off-switch.
// A band's follower reads its level; its curves' gain is applied with nothing behind it.
// So threshold, ratio, upThreshold, upRatio, depth and makeup each set the gain at once:
// each is smoothed (20 ms) and glided sample by sample (glide, below), so a host's ramp of
// it is one line, however the host cut its calls; while none moves they are the bands'
// settings, and the kernel runs as it ran. `low` and `high` retune the crossovers:
// they are smoothed too, so a host ramps them and they are retuned each call of the ramp
// (32 frames at most), the filters' state kept, in place of one jump of the coefficients.

import { multibandBlock, split3, tail, BAND } from './multiband.js'

// k[i] = the followers' coefficient for the time v[j] (ms), α = e^(−1/(τ·fs)), as @audio/dynamics-envelope computes it;
// only arrays and indices cross the call (a number V8 passes to a call it does not inline is a new object)
const coefAt = (k, i, v, j, sr) => { k[i] = v[j] <= 0 ? 0 : Math.exp(-1 / (v[j] * 0.001 * sr)) }

export const multiband = (ctx) => {
	const sr = ctx.sampleRate, M = ctx.maxBlockSize, st = [], bst = [], none = new Float32Array(0), rings = [none, none, none]
	const co = new Float64Array(55), at = Int32Array.of(0, 3, 7, 11), set = new Float64Array(3 * BAND), was = new Float64Array(4).fill(NaN), f = new Float64Array(3)
	const tmp = new Float32Array(M), acc = new Float64Array(M), g = new Float64Array(6 * GLIDE).fill(NaN), lanes = new Float64Array(6 * M)
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) { st.push(new Float64Array(22)); bst.push(new Float64Array(9)) }
	// each band compressed, knee 6 dB, the upward curve on (upRatio 1 is its off), upKnee 6 dB, upRange 12 dB, peak follower
	for (let b = 0; b < 3; b++) { const o = b * BAND; set[o] = 1; set[o + 3] = 6; set[o + 6] = 1; set[o + 9] = 6; set[o + 10] = 12 }
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		const lo = params.low[0], hi = params.high[0], a = params.attack[0], r = params.release[0], n = inp[0].length
		if (lo !== was[0] || hi !== was[1]) { was[0] = f[0] = lo; was[1] = f[1] = hi; f[2] = sr; split3(co, f) }
		if (a !== was[2]) { was[2] = a; coefAt(set, 11, was, 2, sr); set[BAND + 11] = set[2 * BAND + 11] = set[11] }
		if (r !== was[3]) { was[3] = r; coefAt(set, 12, was, 3, sr); set[BAND + 12] = set[2 * BAND + 12] = set[12] }
		for (let b = 0; b < 3; b++) {
			const o = b * BAND
			set[o + 1] = params.threshold[0]; set[o + 2] = params.ratio[0]; set[o + 4] = params.makeup[0]; set[o + 5] = params.depth[0]
			set[o + 7] = params.upThreshold[0]; set[o + 8] = params.upRatio[0]
		}
		const moving = glide(g, 0, params.threshold, lanes, 0, n, 0) | glide(g, 1, params.ratio, lanes, M, n, 0) | glide(g, 2, params.makeup, lanes, 2 * M, n, 0)
			| glide(g, 3, params.depth, lanes, 3 * M, n, 0) | glide(g, 4, params.upThreshold, lanes, 4 * M, n, 0) | glide(g, 5, params.upRatio, lanes, 5 * M, n, 0)
		for (let c = 0; c < inp.length; c++) multibandBlock(inp[c], out[c], co, at, st[c], set, bst[c], rings, tmp, acc, moving ? lanes : undefined, M)
	}
}
multiband.channels = 'any'
// to 60 dB under the input's level, with what makeup and the upward lift (12 dB at most, times depth) may add to the ring
multiband.tail = ({ sampleRate, params }) => tail(params.low[0], sampleRate, params.makeup[0] + (params.upRatio[0] > 1 ? 12 * params.depth[0] : 0))
multiband.params = {
	low:         { type: 'number', min: 40, max: 1000, default: 200, unit: 'Hz', curve: 'log', smoothing: 0.02 },
	high:        { type: 'number', min: 1000, max: 12000, default: 2000, unit: 'Hz', curve: 'log', smoothing: 0.02 },
	threshold:   { type: 'number', min: -60, max: 0, default: -24, unit: 'dB', smoothing: 0.02 },
	ratio:       { type: 'number', min: 1, max: 20, default: 3, smoothing: 0.02 },
	upThreshold: { type: 'number', min: -80, max: 0, default: -40, unit: 'dB', smoothing: 0.02 },
	upRatio:     { type: 'number', min: 1, max: 20, default: 1, smoothing: 0.02 },
	depth:       { type: 'number', min: 0, max: 2, default: 1, smoothing: 0.02 },
	attack:      { type: 'number', min: 0.1, max: 100, default: 5, unit: 'ms' },
	release:     { type: 'number', min: 20, max: 2000, default: 150, unit: 'ms' },
	makeup:      { type: 'number', min: -12, max: 24, default: 0, unit: 'dB', smoothing: 0.02 },
}

// A value that scales the signal, glided sample by sample so that a host's steps of it join into one line: the family's
// glide (every other package keeps its copy in util.js, where its comment says why it plays the host's line 32 frames
// late; this package ships no util.js). `g`: the memory, GLIDE slots a value from j·GLIDE (made NaN); `src`: the param's
// array; this call's `n` values go to `row` from `at`, as they are or (`lin` 1) as the gain e^(v·ln10/20) of a value in
// dB. Returns 1 while they move, 0 when every one is the value.
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
