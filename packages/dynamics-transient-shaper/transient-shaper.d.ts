/** Transient shaper — a level follower and a slow copy of it separate transient from sustain, then independently boost/cut each. Mutates `data` in place; no streaming factory (transientBlock is its loop on typed state). */
export interface TransientShaperOptions {
  /** linear gain delta applied to the transient portion (not dB): 1 ≈ double attack peaks, -1 can null them out, default 0 */
  attackGain?: number
  /** linear gain delta applied to the sustain portion (not dB), default 0 */
  sustainGain?: number
  /** Hz, default 44100 */
  fs?: number
  /**
   * @internal continuation state carried automatically across calls when the
   * same options object is reused for successive chunks — do not set directly.
   */
  _envFast?: number
  /** @internal see `_envFast` */
  _envSlow?: number
}

/** Mutates `data` in place and returns it. Pass the same `options` object across calls to continue envelope state between chunks. */
export default function transientShaper(data: Float32Array, options?: TransientShaperOptions): Float32Array

/** The followers' coefficients at `fs` Hz into `settings`' first three slots (transientBlock's): the level's attack (1 ms) and release (100 ms), its slow copy's rise (50 ms); returns `settings`. */
export function transientSet(settings: Float64Array, fs: number): Float64Array

/** The default export's loop, allocating nothing; the manifest's path: one block of one channel into `out` (may be `x`, returned). `state`: Float64Array(2), the level and its slow copy. `settings`: Float64Array(5), transientSet's three coefficients, attackGain, sustainGain. `lanes`: attackGain and sustainGain for each sample, as a host's ramp moves them, from 0 and `stride`; empty or absent, `settings`'s. */
export function transientBlock(x: Float32Array | Float64Array, out: Float32Array | Float64Array, state: Float64Array, settings: Float64Array, lanes?: Float64Array, stride?: number): Float32Array | Float64Array
