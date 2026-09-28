// Gain riding / dialogue leveler (FFmpeg dynaudnorm, Vocal Rider class):
// framewise RMS → gain toward target, gaussian-smoothed across frames, peak-guarded,
// linearly interpolated between frame centers. Batch, non-causal by design.
// Frames more than `gate` dB under the speech (the energy mean of the frames over −70 dBFS, a relative gate
// as ITU-R BS.1770-4 §5 reads a programme) are pauses: they hold the nearest speech frame's gain, so the room
// between phrases keeps its place under the voice instead of rising by up to maxGain.
import { db2lin, lin2db } from './util.js'

export default function leveler (data, { fs = 44100, target = -20, frame = 0.5, maxGain = 12, smooth = 5, gate = 20 } = {}) {
	let win = Math.max(1, Math.round(frame * fs))
	let nFrames = Math.max(1, Math.ceil(data.length / win))
	let level = new Float64Array(nFrames), guard = new Float64Array(nFrames)

	for (let f = 0; f < nFrames; f++) {
		let from = f * win, to = Math.min(data.length, from + win)
		let e = 0, peak = 0
		for (let i = from; i < to; i++) { e += data[i] * data[i]; let a = Math.abs(data[i]); if (a > peak) peak = a }
		level[f] = lin2db(Math.sqrt(e / (to - from)))
		// peak guard: never push a frame above −0.5 dBFS
		guard[f] = peak > 0 ? lin2db(0.94 / peak) : Infinity
	}
	let loud = 0, n = 0
	for (let f = 0; f < nFrames; f++) if (level[f] > -70) { loud += 10 ** (level[f] / 10); n++ }
	let floor = n ? 10 * Math.log10(loud / n) - gate : Infinity

	// speech frames ride to target; pauses hold the last speech gain (the first one before any speech)
	let gains = new Float64Array(nFrames), held = NaN
	for (let f = 0; f < nFrames; f++) {
		if (level[f] > floor) held = Math.min(maxGain, Math.max(-maxGain, target - level[f]))
		gains[f] = held
	}
	let first = gains.findIndex(g => !Number.isNaN(g))
	gains.fill(first < 0 ? 0 : gains[first], 0, first < 0 ? nFrames : first)

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
	// the guard after smoothing: a sample's gain interpolates its frame's and a neighbour's, so each frame's
	// gain stays under its neighbours' guards too
	for (let f = 0; f < nFrames; f++) sm[f] = Math.min(sm[f], guard[f], f > 0 ? guard[f - 1] : Infinity, f < nFrames - 1 ? guard[f + 1] : Infinity)
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
