// Local helpers (inlined family convention — no shared-dep package).

// Wrap { write, flush } into a single callable: write(chunk) → process, write() → flush.
export function writer(s) {
  return (chunk) => chunk ? s.write(chunk) : s.flush()
}

export function concat(a, b) {
  if (!b || !b.length) return a
  if (!a.length) return b
  let out = new Float32Array(a.length + b.length)
  out.set(a)
  out.set(b, a.length)
  return out
}

export const db2lin = (db) => Math.pow(10, db / 20)

export const lin2db = (lin) => 20 * Math.log10(Math.max(Math.abs(lin), 1e-10))
