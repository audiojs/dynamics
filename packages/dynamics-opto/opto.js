// Optical compressor model (LA-2A class) — RMS detection, wide soft knee, ~3:1, and the
// T4 signature: program-dependent release that slows the longer gain reduction persists.
import { envelope } from '@audio/dynamics-envelope'
import { compressorGain } from '@audio/dynamics-compressor'
import { writer, concat, db2lin, lin2db, timeCoef } from '@audio/dynamics-core'

export default function opto (data, opts) {
	if (!(data instanceof Float32Array)) return writer(optoStream(data))
	let s = optoStream(opts)
	return concat(s.write(data), s.flush())
}

export function optoStream (opts = {}) {
	let sr = opts.sampleRate || opts.fs || 44100
	let threshold = opts.threshold ?? -20
	let ratio = opts.ratio ?? 3
	let knee = opts.knee ?? 10
	let makeup = opts.makeup ?? 0
	let env = envelope({ ...opts, sampleRate: sr, detector: 'rms', attack: opts.attack ?? 10, release: 1 })
	let gr = 0                       // smoothed gain reduction (dB, ≤0)
	let memory = 0                   // integrates time-under-reduction → slows release (T4 cell)
	let memCoef = timeCoef(3000, sr) // ~3 s history
	let aCoef = timeCoef(opts.attack ?? 10, sr)

	return {
		write (chunk) {
			let out = new Float32Array(chunk.length)
			for (let i = 0; i < chunk.length; i++) {
				let target = compressorGain(lin2db(env(chunk[i])), threshold, ratio, knee)
				memory = memory * memCoef + (target < -1 ? 1 - memCoef : 0)
				let relMs = (opts.release ?? 300) * (1 + 6 * memory)
				let rCoef = timeCoef(relMs, sr)
				gr = target < gr ? target + (gr - target) * aCoef : target + (gr - target) * rCoef
				out[i] = chunk[i] * db2lin(gr + makeup)
			}
			return out
		},
		flush () { return new Float32Array(0) }
	}
}
