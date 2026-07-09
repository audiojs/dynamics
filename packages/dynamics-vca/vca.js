// VCA compressor model (dbx/SSL-bus class) — clean feed-forward peak detection,
// near-hard knee, precise dB-linear gain computation. The transparent workhorse.
import { envelope } from '@audio/dynamics-envelope'
import { compressorGain } from '@audio/dynamics-compressor'
import { writer, concat, db2lin, lin2db, timeCoef } from './util.js'

export default function vca (data, opts) {
	if (!(data instanceof Float32Array)) return writer(vcaStream(data))
	let s = vcaStream(opts)
	return concat(s.write(data), s.flush())
}

export function vcaStream (opts = {}) {
	let sr = opts.sampleRate || opts.fs || 44100
	let threshold = opts.threshold ?? -20
	let ratio = opts.ratio ?? 4
	let knee = opts.knee ?? 1
	let makeup = opts.makeup ?? 0
	let env = envelope({ ...opts, sampleRate: sr, detector: 'peak', attack: opts.attack ?? 1, release: 1 })
	let gr = 0
	let aCoef = timeCoef(opts.attack ?? 1, sr)
	let rCoef = timeCoef(opts.release ?? 150, sr)

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
