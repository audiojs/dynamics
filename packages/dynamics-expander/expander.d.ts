/** Downward (default) or upward expander — the below/above-threshold complement of a compressor. */
export interface ExpanderOptions {
  /** 'downward' (softer gate, reduces gain below threshold) or 'upward' (de-compression, lifts gain above threshold), default 'downward' */
  mode?: 'downward' | 'upward'
  /** dB, default -30 */
  threshold?: number
  /** default 2 */
  ratio?: number
  /** dB, default 6 */
  knee?: number
  /** dB, max reduction (downward, negative) or max lift (upward, positive), default -40 (downward) / 20 (upward) */
  range?: number
  /** ms, default 5 (envelope default) */
  attack?: number
  /** ms, default 50 (envelope default) */
  release?: number
  /** envelope detector, default 'peak' */
  detector?: 'peak' | 'rms'
  /** RMS window, samples, default 256 (only used when detector is 'rms') */
  rmsWindow?: number
  /** sample rate, Hz, default 44100 (alias `fs`) */
  sampleRate?: number
  /** alias of sampleRate, Hz, default 44100 */
  fs?: number
}

/** Process a whole buffer. Returns a new Float32Array of the same length. */
export default function expander(data: Float32Array, options?: ExpanderOptions): Float32Array
/** Streaming form: returns a writer — call with a chunk to process it, call with no argument to flush. */
export default function expander(options?: ExpanderOptions): (chunk?: Float32Array) => Float32Array

/** { write, flush } streaming primitive underlying the default export's streaming form. */
export function expanderStream(options?: ExpanderOptions): { write(chunk: Float32Array): Float32Array, flush(): Float32Array }

/** Soft-knee downward expansion curve. Returns gain reduction in dB (≤ 0), clamped to rangeDb (negative). */
export function expanderGain(levelDb: number, threshold: number, ratio: number, kneeDb: number, rangeDb: number): number

/** Soft-knee upward expansion curve — the above-threshold complement of expanderGain. Returns gain lift in dB (≥ 0), clamped to rangeDb (positive). */
export function upwardExpanderGain(levelDb: number, threshold: number, ratio: number, kneeDb: number, rangeDb: number): number
