/** Lookahead brickwall limiter — sliding-window max drives the envelope, instant attack, exponential release. */
export interface LimiterOptions {
  /** dB, brickwall ceiling, default -0.3 */
  ceiling?: number
  /** ms, lookahead window (introduces equal output delay), default 5 */
  lookahead?: number
  /** ms, default 50 */
  release?: number
  /** sample rate, Hz, default 44100 (no `fs` alias — this atom reads `sampleRate` only) */
  sampleRate?: number
}

/** Process a whole buffer. Returns a new Float32Array (length may differ slightly around lookahead warm-up/flush). */
export default function limiter(data: Float32Array, options?: LimiterOptions): Float32Array
/** Streaming form: returns a writer — call with a chunk to process it, call with no argument to flush. */
export default function limiter(options?: LimiterOptions): (chunk?: Float32Array) => Float32Array

/** { write, flush } streaming primitive underlying the default export's streaming form. */
export function limiterStream(options?: LimiterOptions): { write(chunk: Float32Array): Float32Array, flush(): Float32Array }
