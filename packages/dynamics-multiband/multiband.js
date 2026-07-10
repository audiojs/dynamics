// Multiband compressor — Linkwitz-Riley band split + per-band soft-knee compression + flat sum.
// SoX mcompand / FFmpeg-class; the Music Enhancer / Auto-Chain mastering stage.
// LR crossover bands sum flat by construction (@audio/eq-crossover handles polarity).

import crossover from '@audio/eq-crossover'
import compressor from '@audio/dynamics-compressor'
import { step, state } from '@audio/biquad'

/**
 * @param {Float32Array} data — mono PCM, processed in place
 * @param {object} opts
 * @param {number[]} [opts.freqs=[200,2000]] — crossover frequencies (N-1 for N bands)
 * @param {object|object[]} [opts.bands] — @audio/dynamics-compressor params per band
 *   ({threshold, ratio, knee, attack, release, makeup, upThreshold, upRatio, upKnee,
 *   upRange, depth} — upward compression and the OTT "Depth" macro included, spread
 *   straight into the per-band compressor() call) or one object shared by all bands;
 *   omit a band's params (or pass null) to leave that band uncompressed
 * @param {number} [opts.order=4] — LR order (2, 4, 8)
 * @param {number} [opts.fs=44100]
 */
export default function multiband (data, { freqs = [200, 2000], bands, order = 4, fs = 44100 } = {}) {
	let sos = crossover(freqs, order, fs)
	let out = new Float64Array(data.length)

	for (let b = 0; b < sos.length; b++) {
		let band = Float32Array.from(data)
		for (let sec of sos[b]) {
			let st = state()
			for (let i = 0; i < band.length; i++) band[i] = step(sec, st, band[i])
		}
		let params = Array.isArray(bands) ? bands[b] : bands
		if (params) band = compressor(band, { fs, ...params })
		for (let i = 0; i < out.length; i++) out[i] += band[i]
	}

	for (let i = 0; i < data.length; i++) data[i] = out[i]
	return data
}
