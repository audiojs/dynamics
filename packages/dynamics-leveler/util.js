// Local helpers (inlined family convention — no shared-dep package).

export const db2lin = (db) => Math.pow(10, db / 20)

export const lin2db = (lin) => 20 * Math.log10(Math.max(Math.abs(lin), 1e-10))
