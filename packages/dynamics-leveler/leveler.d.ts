/** Gain-riding dialogue leveler — framewise RMS → gain toward target, gaussian-smoothed, peak-guarded. Batch, non-causal by design (no streaming form). */
export interface LevelerOptions {
  /** Hz, default 44100 */
  fs?: number
  /** dB, RMS loudness target, default -20 */
  target?: number
  /** s, analysis window, default 0.5 */
  frame?: number
  /** dB, symmetric per-frame gain clamp, default 12 */
  maxGain?: number
  /** frames, gaussian smoothing radius, default 5 */
  smooth?: number
}

/** Mutates `data` in place (applies gain) and returns it. No streaming form — smoothing looks at frames on both sides of each point. */
export default function leveler(data: Float32Array, options?: LevelerOptions): Float32Array
