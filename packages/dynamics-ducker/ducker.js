import { envelope } from '@audio/dynamics-envelope'
import { compressorGain } from '@audio/dynamics-compressor'
import { writer2, concat, db2lin, lin2db } from './util.js'

// External-sidechain compressor: main signal's gain is reduced in proportion
// to the level of a separate side signal (e.g. voice track ducking music).
export default function ducker(main, side, opts) {
  if (!(main instanceof Float32Array)) return writer2(duckerStream(main))
  let s = duckerStream(opts)
  return concat(s.write(main, side), s.flush())
}

export function duckerStream(opts = {}) {
  let threshold = opts.threshold ?? -30
  let ratio = opts.ratio ?? 4
  let knee = opts.knee ?? 6
  let range = opts.range ?? -24  // max reduction in dB
  let env = envelope({ ...opts, attack: opts.attack ?? 20, release: opts.release ?? 300 })

  return {
    write(main, side) {
      let n = Math.min(main.length, side.length)
      let out = new Float32Array(main.length)
      for (let i = 0; i < n; i++) {
        let rDb = compressorGain(lin2db(env(side[i])), threshold, ratio, knee)
        if (rDb < range) rDb = range
        out[i] = main[i] * db2lin(rDb)
      }
      for (let i = n; i < main.length; i++) out[i] = main[i]
      return out
    },
    flush() { return new Float32Array(0) }
  }
}
