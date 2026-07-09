// Vari-Mu compressor model (Fairchild class) — feedback topology (detector reads the
// output), very soft wide knee, slow attack, and ratio that grows with drive (the "mu").
import { envelope } from '@audio/dynamics-envelope'
import { compressorGain } from '@audio/dynamics-compressor'
import { writer, concat, db2lin, lin2db, timeCoef } from './util.js'

export default function varimu (data, opts) {
	if (!(data instanceof Float32Array)) return writer(varimuStream(data))
	let s = varimuStream(opts)
	return concat(s.write(data), s.flush())
}

export function varimuStream (opts = {}) {
	let sr = opts.sampleRate || opts.fs || 44100
	let threshold = opts.threshold ?? -22
	let knee = opts.knee ?? 15
	let makeup = opts.makeup ?? 0
	let env = envelope({ ...opts, sampleRate: sr, detector: 'rms', attack: opts.attack ?? 25, release: 1 })
	let gr = 0
	let aCoef = timeCoef(opts.attack ?? 25, sr)
	let rCoef = timeCoef(opts.release ?? 400, sr)

	return {
		write (chunk) {
			let out = new Float32Array(chunk.length)
			for (let i = 0; i < chunk.length; i++) {
				let y = chunk[i] * db2lin(gr)           // feedback: detect the compressed output
				let over = lin2db(env(y)) - threshold
				let mu = 1.8 + Math.max(0, over) / 5    // ratio grows with drive
				let target = compressorGain(lin2db(env(y)) , threshold, mu, knee)
				gr = target < gr ? target + (gr - target) * aCoef : target + (gr - target) * rCoef
				out[i] = chunk[i] * db2lin(gr + makeup)
			}
			return out
		},
		flush () { return new Float32Array(0) }
	}
}
