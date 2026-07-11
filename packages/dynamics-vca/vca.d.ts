/** VCA compressor model (dbx/SSL-bus class) — clean feed-forward peak detection, near-hard knee. */
export interface VcaOptions {
  /** dB, default -20 */
  threshold?: number
  /** default 4 */
  ratio?: number
  /** dB, near-hard knee, default 1 */
  knee?: number
  /** ms, default 1 */
  attack?: number
  /** ms, default 150 */
  release?: number
  /** dB, output makeup gain, default 0 */
  makeup?: number
  /** sample rate, Hz, default 44100 (alias `fs`) */
  sampleRate?: number
  /** alias of sampleRate, Hz, default 44100 */
  fs?: number
}

/** Process a whole buffer. Returns a new Float32Array of the same length. */
export default function vca(data: Float32Array, options?: VcaOptions): Float32Array
/** Streaming form: returns a writer — call with a chunk to process it, call with no argument to flush. */
export default function vca(options?: VcaOptions): (chunk?: Float32Array) => Float32Array

/** { write, flush } streaming primitive underlying the default export's streaming form. */
export function vcaStream(options?: VcaOptions): { write(chunk: Float32Array): Float32Array, flush(): Float32Array }
