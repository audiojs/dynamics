// Local helpers (inlined family convention — no shared-dep package).

export const db2lin = (db) => Math.pow(10, db / 20)

export const lin2db = (lin) => 20 * Math.log10(Math.max(Math.abs(lin), 1e-10))

// One-pole smoothing coefficient, α = e^(−1/(τ·fs)) (Giannoulis et al. 2012, eq. 7): τ in ms reaches 1 − 1/e.
export function timeCoef(ms, sampleRate) {
  if (ms <= 0) return 0
  return Math.exp(-1 / (ms * 0.001 * sampleRate))
}

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
