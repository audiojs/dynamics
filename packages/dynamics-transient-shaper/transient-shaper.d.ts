/** Transient shaper — dual fast/slow envelope followers separate transient from sustain, then independently boost/cut each. Mutates `data` in place; no streaming form. */
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
