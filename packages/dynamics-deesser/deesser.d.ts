/** De-esser — 'broadband' (bandpass-sidechained compressor, gain reduction applied broadband) or 'band' (dynamic peaking-EQ cut, only the sibilance band moves). */
export interface DeesserOptions {
  /** 'broadband' (simple, transparent) or 'band' (program below the sibilance band stays untouched), default 'broadband' */
  mode?: 'broadband' | 'band'
  /** Hz, sibilance center, default 6500 */
  freq?: number
  /** bandpass Q (broadband mode) / peaking-cut Q (band mode), default 2 (broadband) / 1.4 (band) */
  q?: number
  /** dB, on sidechain level, default -20 */
  threshold?: number
  /** default 4 (broadband only — band mode's cut depth is derived from the ratio-shaped curve directly) */
  ratio?: number
  /** dB, soft-knee width, broadband mode only, default 6 */
  knee?: number
  /** ms, default 1 */
  attack?: number
  /** ms, default 40 */
  release?: number
  /** samples, EQ-gain recompute block, band mode only, default 64 */
  block?: number
  /** sidechain envelope detector, broadband mode only (passed through to the underlying follower), default 'peak' */
  detector?: 'peak' | 'rms'
  /** sample rate, Hz, default 44100 (no `fs` alias — this atom reads `sampleRate` only) */
  sampleRate?: number
}

/** Process a whole buffer. Returns a new Float32Array of the same length. */
export default function deesser(data: Float32Array, options?: DeesserOptions): Float32Array
/** Streaming form: returns a writer — call with a chunk to process it, call with no argument to flush. */
export default function deesser(options?: DeesserOptions): (chunk?: Float32Array) => Float32Array

/** { write, flush } streaming primitive underlying the default export's streaming form. */
export function deesserStream(options?: DeesserOptions): { write(chunk: Float32Array): Float32Array, flush(): Float32Array }
