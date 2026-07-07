// RBJ audio EQ cookbook biquads — only what dynamics-processor needs for
// sidechain filtering (deesser). For a full filter library see audio-filter.

const PI2 = 2 * Math.PI

export function bandpass(sr, freq, q) {
  let w0 = PI2 * freq / sr
  let cw = Math.cos(w0)
  let a = Math.sin(w0) / (2 * q)
  let a0 = 1 + a
  return {
    b0: a / a0, b1: 0, b2: -a / a0,
    a1: -2 * cw / a0, a2: (1 - a) / a0,
  }
}

export function biquad(c, s, x) {
  let y = c.b0 * x + c.b1 * s.x1 + c.b2 * s.x2 - c.a1 * s.y1 - c.a2 * s.y2
  s.x2 = s.x1; s.x1 = x
  s.y2 = s.y1; s.y1 = y
  return y
}

export const biquadState = () => ({ x1: 0, x2: 0, y1: 0, y2: 0 })
