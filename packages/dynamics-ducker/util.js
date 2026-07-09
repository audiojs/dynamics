// Local helpers (inlined family convention — no shared-dep package).

export const db2lin = (db) => Math.pow(10, db / 20)

export const lin2db = (lin) => 20 * Math.log10(Math.max(Math.abs(lin), 1e-10))

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
