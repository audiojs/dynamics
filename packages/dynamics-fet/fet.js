// FET compressor model (1176 class) — very fast peak detection (0.2 ms default attack),
// fixed-style high ratios, firm knee. Character = speed, not color.
import { envelope } from '@audio/dynamics-envelope'
import { compressorGain } from '@audio/dynamics-compressor'
import { writer, concat, db2lin, lin2db, timeCoef } from '@audio/dynamics-core'

export default function fet (data, opts) {
	if (!(data instanceof Float32Array)) return writer(fetStream(data))
	let s = fetStream(opts)
	return concat(s.write(data), s.flush())
}

export function fetStream (opts = {}) {
	let sr = opts.sampleRate || opts.fs || 44100
	let threshold = opts.threshold ?? -18
	let ratio = opts.ratio ?? 8
	let knee = opts.knee ?? 3
	let makeup = opts.makeup ?? 0
	let env = envelope({ ...opts, sampleRate: sr, detector: 'peak', attack: opts.attack ?? 0.2, release: 1 })
	let gr = 0
	let aCoef = timeCoef(opts.attack ?? 0.2, sr)
	let rCoef = timeCoef(opts.release ?? 120, sr)

	return {
		write (chunk) {
			let out = new Float32Array(chunk.length)
			for (let i = 0; i < chunk.length; i++) {
				let target = compressorGain(lin2db(env(chunk[i])), threshold, ratio, knee)
				gr = target < gr ? target + (gr - target) * aCoef : target + (gr - target) * rCoef
				out[i] = chunk[i] * db2lin(gr + makeup)
			}
			return out
		},
		flush () { return new Float32Array(0) }
	}
}
