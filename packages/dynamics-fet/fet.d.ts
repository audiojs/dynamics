/** FET compressor model (1176 class) — very fast peak detection, high ratios, firm knee. */
export interface FetOptions {
  /** dB, default -18 */
  threshold?: number
  /** default 8 */
  ratio?: number
  /** dB, firm knee, default 3 */
  knee?: number
  /** ms, default 0.2 */
  attack?: number
  /** ms, default 120 */
  release?: number
  /** dB, output makeup gain, default 0 */
  makeup?: number
  /** sample rate, Hz, default 44100 (alias `fs`) */
  sampleRate?: number
  /** alias of sampleRate, Hz, default 44100 */
  fs?: number
}

/** Process a whole buffer. Returns a new Float32Array of the same length. */
export default function fet(data: Float32Array, options?: FetOptions): Float32Array
/** Streaming form: returns a writer — call with a chunk to process it, call with no argument to flush. */
export default function fet(options?: FetOptions): (chunk?: Float32Array) => Float32Array

/** { write, flush } streaming primitive underlying the default export's streaming form. */
export function fetStream(options?: FetOptions): { write(chunk: Float32Array): Float32Array, flush(): Float32Array }
