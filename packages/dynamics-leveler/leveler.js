// Gain riding / dialogue leveler (FFmpeg dynaudnorm, Vocal Rider class):
// framewise RMS → gain toward target, gaussian-smoothed across frames, peak-guarded,
// linearly interpolated between frame centers. Batch, non-causal by design.
import { db2lin, lin2db } from './util.js'

export default function leveler (data, { fs = 44100, target = -20, frame = 0.5, maxGain = 12, smooth = 5 } = {}) {
	let win = Math.max(1, Math.round(frame * fs))
	let nFrames = Math.max(1, Math.ceil(data.length / win))
	let gains = new Float64Array(nFrames)

	for (let f = 0; f < nFrames; f++) {
		let from = f * win, to = Math.min(data.length, from + win)
		let e = 0, peak = 0
		for (let i = from; i < to; i++) { e += data[i] * data[i]; let a = Math.abs(data[i]); if (a > peak) peak = a }
		let rms = Math.sqrt(e / (to - from))
		let g = rms > 1e-6 ? Math.min(maxGain, Math.max(-maxGain, target - lin2db(rms))) : 0
		// peak guard: never push a frame above −0.5 dBFS
		if (peak > 0) g = Math.min(g, lin2db(0.94 / peak))
		gains[f] = g
	}
	// gaussian-ish smoothing across frames
	let sm = new Float64Array(nFrames)
	for (let f = 0; f < nFrames; f++) {
		let acc = 0, wsum = 0
		for (let k = -smooth; k <= smooth; k++) {
			let j = f + k
			if (j < 0 || j >= nFrames) continue
			let w = Math.exp(-k * k / (smooth * smooth / 2 + 1e-9))
			acc += gains[j] * w; wsum += w
		}
		sm[f] = acc / wsum
	}
	// linear interpolation between frame centers
	for (let i = 0; i < data.length; i++) {
		let pos = (i - win / 2) / win
		let f0 = Math.max(0, Math.min(nFrames - 1, Math.floor(pos)))
		let f1 = Math.min(nFrames - 1, f0 + 1)
		let t = Math.max(0, Math.min(1, pos - f0))
		data[i] *= db2lin(sm[f0] * (1 - t) + sm[f1] * t)
	}
	return data
}
