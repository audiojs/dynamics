/** Optical compressor model (LA-2A class) — RMS detection, wide soft knee, T4 program-dependent release. */
export interface OptoOptions {
  /** dB, default -20 */
  threshold?: number
  /** default 3 */
  ratio?: number
  /** dB, wide knee, default 10 */
  knee?: number
  /** ms, default 10 */
  attack?: number
  /** ms, nominal — the T4 cell stretches this up to 7× the longer gain reduction persists, default 300 */
  release?: number
  /** dB, output makeup gain, default 0 */
  makeup?: number
  /** RMS window, samples, default 256 */
  rmsWindow?: number
  /** sample rate, Hz, default 44100 (alias `fs`) */
  sampleRate?: number
  /** alias of sampleRate, Hz, default 44100 */
  fs?: number
}

/** Process a whole buffer. Returns a new Float32Array of the same length. */
export default function opto(data: Float32Array, options?: OptoOptions): Float32Array
/** Streaming form: returns a writer — call with a chunk to process it, call with no argument to flush. */
export default function opto(options?: OptoOptions): (chunk?: Float32Array) => Float32Array

/** { write, flush } streaming primitive underlying the default export's streaming form. */
export function optoStream(options?: OptoOptions): { write(chunk: Float32Array): Float32Array, flush(): Float32Array }
