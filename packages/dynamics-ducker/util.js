// Local helpers (inlined family convention — no shared-dep package).

// e^(dB·ln10/20) and ln·20/ln10, not 10^(dB/20) and 20·log10: half the cost in V8 (exp and log take ~9 ns, pow
// and log10 ~17-19), a few double ulps from them, far under a float32 ulp.
export const db2lin = (db) => Math.exp(db * (Math.LN10 / 20))

export const lin2db = (lin) => 20 / Math.LN10 * Math.log(Math.max(Math.abs(lin), 1e-10))

// Two-input variant for ducker/sidechain.
export function writer2(s) {
  return (main, side) => main ? s.write(main, side || main) : s.flush()
}

export function concat(a, b) {
  if (!b || !b.length) return a
  if (!a.length) return b
  let out = new Float32Array(a.length + b.length)
  out.set(a)
  out.set(b, a.length)
  return out
}
