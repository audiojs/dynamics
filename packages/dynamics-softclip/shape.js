// Oversampled nonlinearity application (inlined family convention — mirrors
// @audio/saturate-waveshaper/shape.js, adapted to softclip's non-mutating,
// no-mix style: this package always returns a new array, never mutates `data`).
// Upsample (windowed-sinc) → per-sample transfer → decimate (windowed-sinc,
// anti-aliased), so waveshaping harmonics above Nyquist don't fold back as aliases.

import resample from '@audio/resample-sinc'

/**
 * Apply a memoryless transfer function, optionally oversampled.
 * @param {Float32Array} data
 * @param {(x:number)=>number} fn — transfer curve
 * @param {object} opts — { fs=44100, oversample=1 (disables oversampling) }
 * @returns {Float32Array} new array, same length as data
 */
export function shape(data, fn, { fs = 44100, oversample = 1 } = {}) {
	if (oversample > 1) {
		let up = resample(data, { from: fs, to: fs * oversample })
		for (let i = 0; i < up.length; i++) up[i] = fn(up[i])
		let down = resample(up, { from: fs * oversample, to: fs })
		let out = new Float32Array(data.length)
		out.set(down.subarray(0, Math.min(data.length, down.length)))
		return out
	}
	let out = new Float32Array(data.length)
	for (let i = 0; i < data.length; i++) out[i] = fn(data[i])
	return out
}
