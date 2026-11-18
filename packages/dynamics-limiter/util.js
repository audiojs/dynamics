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

// One-pole smoothing coefficient: y[n] = c·y[n-1] + (1-c)·x[n]. ms → coefficient.
export function timeCoef(ms, sampleRate) {
  if (ms <= 0) return 0
  return Math.exp(-1 / (ms * 0.001 * sampleRate))
}

// Stereo link, 0 to 1: each channel's level made, in place, link times the loudest channel's plus (1 − link) times its
// own, sample by sample. At 1 every channel reads one level and takes one gain, so linked channels act together when
// one crosses the threshold and the stereo image holds (Jeffs, Holden & Bohn, "Dynamics Processors: Technology &
// Applications", RaneNote 155, 2005, ch. 1). `lev`: a Float64Array per channel, `nc` channels of `n` samples, each the
// level the kernel's gain computer reads (linear); `at`: the link in its first slot, the param's own array (a number V8
// passes to a call it does not inline is a new object; Node 20 and 22 did so here as link moved every call).
export function link(lev, nc, n, at) {
  let amt = at[0], own = 1 - amt
  for (let i = 0; i < n; i++) {
    let m = lev[0][i]
    for (let c = 1; c < nc; c++) if (lev[c][i] > m) m = lev[c][i]
    for (let c = 0; c < nc; c++) lev[c][i] = amt * m + own * lev[c][i]
  }
}

// dst[i] = db2lin(src[j]), and dst[i] = timeCoef(src[j], sampleRate), their arithmetic written out: the manifests'
// coefficients, with only arrays and indices crossing the call and none made inside it. A number V8 passes to a call it
// does not inline is a new object, and Node 20 and 22 left such calls out of the manifests' process once it read a key
// and linked channels: a block allocated as values moved.
export function linAt(dst, i, src, j) { dst[i] = Math.pow(10, src[j] / 20) }
export function coefAt(dst, i, src, j, sampleRate) { let ms = src[j]; dst[i] = ms <= 0 ? 0 : Math.exp(-1 / (ms * 0.001 * sampleRate)) }
