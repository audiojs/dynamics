/** Branching one-pole envelope follower — separate attack/release, peak or RMS detection. */
export interface EnvelopeOptions {
  /** sample rate, Hz, default 44100 (alias `fs`) */
  sampleRate?: number
  /** alias of sampleRate, Hz, default 44100 */
  fs?: number
  /** attack time constant, ms, default 5 */
  attack?: number
  /** release time constant, ms, default 50 */
  release?: number
  /** detector type, default 'peak' */
  detector?: 'peak' | 'rms'
  /** RMS window, samples, default 256 (only used when detector is 'rms') */
  rmsWindow?: number
}

/** Create a stateful per-sample envelope detector: call with each input sample, returns the tracked envelope (linear, ≥ 0). */
export function envelope(options?: EnvelopeOptions): (x: number) => number
