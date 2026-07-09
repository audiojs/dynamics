// Local helpers (inlined family convention — no shared-dep package).

// Wrap { write, flush } into a single callable: write(chunk) → process, write() → flush.
export function writer(s) {
  return (chunk) => chunk ? s.write(chunk) : s.flush()
}

export const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v
