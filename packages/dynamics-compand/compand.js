import { envelope } from '@audio/dynamics-envelope'
import { writer, concat, db2lin, lin2db } from '@audio/dynamics-core'

// Multi-segment compander (SoX `compand`). Arbitrary piecewise-linear transfer
// in dB. A single curve unifies compression, expansion and gating: points below
// the identity line reduce loud parts; points above raise quiet parts.
export default function compand(data, opts) {
  if (!(data instanceof Float32Array)) return writer(compandStream(data))
  let s = compandStream(opts)
  return concat(s.write(data), s.flush())
}

export function compandStream(opts = {}) {
  // Points: [[inDb, outDb], ...]. Default = mild compression above -20 dB.
  let points = (opts.points || [[-90, -90], [-60, -60], [-20, -20], [0, -8]])
    .slice().sort((a, b) => a[0] - b[0])
  let env = envelope({ ...opts, attack: opts.attack ?? 5, release: opts.release ?? 200 })

  return {
    write(chunk) {
      let out = new Float32Array(chunk.length)
      for (let i = 0; i < chunk.length; i++) {
        let x = chunk[i]
        let lvl = lin2db(env(x))
        let mapped = transfer(points, lvl)
        out[i] = x * db2lin(mapped - lvl)
      }
      return out
    },
    flush() { return new Float32Array(0) }
  }
}

function transfer(points, x) {
  if (x <= points[0][0]) return points[0][1] + (x - points[0][0])
  if (x >= points[points.length - 1][0]) {
    let [xE, yE] = points[points.length - 1]
    return yE + (x - xE)
  }
  for (let i = 1; i < points.length; i++) {
    let [x1, y1] = points[i]
    if (x <= x1) {
      let [x0, y0] = points[i - 1]
      let t = (x - x0) / (x1 - x0)
      return y0 + t * (y1 - y0)
    }
  }
  return x
}
