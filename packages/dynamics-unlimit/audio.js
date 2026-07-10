// atom manifest — wraps the de-limiter kernel per @audio/compile CONTRACT.
// Mirrors unlimit.js's unlimitStream exactly, per channel: fast/slow envelope pair
// feeds the transient detector; deficit mode (adaptive, default) evaluates the
// transient DEFICIT against crestTarget through three gates — peak hold (~150 dB/s
// release), 10 ms attack window after a fresh peak, ~3 ms confirmation ramp — see
// unlimit.js's header for why each exists; a third envelope matching the fast
// ballistics smooths the target lift so curve corners don't zipper. adaptive: false
// = legacy proportional transient-following (transient exaggerator).
//
// `ceiling`'s params-convention default has no null to switch off with (kernel default:
// null = off, peaks may exceed 0 dBFS by design). Same substitution the compressor
// manifest uses for upThreshold: pin the default above the maximum any signal can
// reach through this atom — amount's declared max is 18 dB, so a ceiling default of
// 24 dB can never engage for a ≤0 dBFS input, a mathematical no-op standing in for "off".

import { envelope } from '@audio/dynamics-envelope'
import { unlimitGain, unlimitDeficitGain } from './unlimit.js'
import { db2lin, lin2db } from './util.js'

const ONSET_FLOOR = 1.5

export const unlimit = (ctx) => {
	const sr = ctx.sampleRate
	const fasts = [], slows = [], smooths = [], xHolds = [], attackTs = [], confirms = []
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) {
		fasts.push(envelope({ sampleRate: sr, attack: ctx.params.fastAttack[0], release: ctx.params.fastRelease[0] }))
		slows.push(envelope({ sampleRate: sr, attack: ctx.params.slowAttack[0], release: ctx.params.slowRelease[0] }))
		smooths.push(envelope({ sampleRate: sr, attack: ctx.params.fastAttack[0], release: ctx.params.fastRelease[0] }))
		xHolds.push(0); attackTs.push(Infinity); confirms.push(0)
	}
	const holdStep = 150 / sr
	const confirmStep = 1 / (0.003 * sr)
	const attackWin = Math.round(0.010 * sr)
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		const amount = params.amount[0], drive = params.drive[0]
		const adaptive = params.adaptive
		const crestTarget = params.crestTarget[0]
		const ceilLin = db2lin(params.ceiling[0])
		for (let c = 0; c < inp.length; c++) {
			const x = inp[c], y = out[c]
			const fast = fasts[c], slow = slows[c], smooth = smooths[c]
			let xHold = xHolds[c], attackT = attackTs[c], confirm = confirms[c]
			for (let i = 0; i < x.length; i++) {
				const fastDb = lin2db(fast(x[i])), slowDb = lin2db(slow(x[i]))
				let target
				if (adaptive) {
					let t = fastDb - slowDb
					if (t < 0) t = 0
					if (t > xHold) { xHold = t; attackT = 0 }
					else { xHold = xHold - holdStep > 0 ? xHold - holdStep : 0; attackT++ }
					confirm = t > ONSET_FLOOR ? (confirm + confirmStep > 1 ? 1 : confirm + confirmStep) : 0
					target = attackT < attackWin ? confirm * unlimitDeficitGain(xHold, crestTarget, amount, drive) : 0
				} else {
					target = unlimitGain(fastDb, slowDb, amount, drive)
				}
				const liftDb = smooth(target)
				let v = x[i] * db2lin(liftDb)
				const a = v < 0 ? -v : v
				if (a > ceilLin) v *= ceilLin / a
				y[i] = v
			}
			xHolds[c] = xHold; attackTs[c] = attackT; confirms[c] = confirm
		}
	}
}
unlimit.channels = 'any'
unlimit.tail = 0
unlimit.params = {
	amount:      { type: 'number', min: 0, max: 18, default: 6, unit: 'dB' },
	drive:       { type: 'number', min: 0, max: 10, default: 1 },
	adaptive:    { type: 'bool', default: true },
	crestTarget: { type: 'number', min: 3, max: 25, default: 10, unit: 'dB' },
	ceiling:     { type: 'number', min: -60, max: 24, default: 24, unit: 'dB' },
	fastAttack:  { type: 'number', min: 0.1, max: 10, default: 0.5, unit: 'ms', flags: ['restart'] },
	fastRelease: { type: 'number', min: 1, max: 100, default: 20, unit: 'ms', flags: ['restart'] },
	slowAttack:  { type: 'number', min: 1, max: 200, default: 20, unit: 'ms', flags: ['restart'] },
	slowRelease: { type: 'number', min: 10, max: 1000, default: 200, unit: 'ms', flags: ['restart'] },
}
