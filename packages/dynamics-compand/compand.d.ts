/** SoX-style multi-segment compander — arbitrary piecewise-linear transfer in dB (compression, expansion and gating under one curve). */
export interface CompandOptions {
  /** `[inDb, outDb]` pairs (any order — sorted internally); points below the identity line compress, above it expand, default `[[-90,-90],[-60,-60],[-20,-20],[0,-8]]` */
  points?: [number, number][]
  /** ms, default 5 */
  attack?: number
  /** ms, default 200 */
  release?: number
  /** envelope detector, passed through to the underlying follower, default 'peak' */
  detector?: 'peak' | 'rms'
  /** RMS window, samples, default 256 (only used when detector is 'rms') */
  rmsWindow?: number
  /** sample rate, Hz, default 44100 (alias `fs`) */
  sampleRate?: number
  /** alias of sampleRate, Hz, default 44100 */
  fs?: number
}

/** Process a whole buffer. Returns a new Float32Array of the same length. */
export default function compand(data: Float32Array, options?: CompandOptions): Float32Array
/** Streaming form: returns a writer — call with a chunk to process it, call with no argument to flush. */
export default function compand(options?: CompandOptions): (chunk?: Float32Array) => Float32Array

/** { write, flush } streaming primitive underlying the default export's streaming form. */
export function compandStream(options?: CompandOptions): { write(chunk: Float32Array): Float32Array, flush(): Float32Array }
