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
  /** hold the reconstructed waveform under the ceiling (dBTP, ITU-R BS.1770 Annex 2), default false; 96 samples more delay */
  truePeak?: boolean
}

/** Process a whole buffer. Returns a new Float32Array (length may differ slightly around lookahead warm-up/flush). */
export default function limiter(data: Float32Array, options?: LimiterOptions): Float32Array
/** Streaming form: returns a writer — call with a chunk to process it, call with no argument to flush. */
export default function limiter(options?: LimiterOptions): (chunk?: Float32Array) => Float32Array

/** Samples the output trails the input by: the lookahead, and 96 with `truePeak`. */
export function latency(options?: LimiterOptions): number

/** { write, flush } streaming primitive underlying the default export's streaming form. */
export function limiterStream(options?: LimiterOptions): { write(chunk: Float32Array): Float32Array, flush(): Float32Array }

/** One channel's lookahead line, the core of limiterStream (`ceiling` and `release` are read from `settings`, not `options`). `run(x, out)` limits a block into `out` (may be `x`), allocating nothing once its scratch is as long as the block, `latency(options)` samples late, 0 while the line first fills, and returns how many samples that was. It is `level(x, peaks)`, each sample's peak into `peaks` (as long as `x` or longer; |x|, or with truePeak the interval's after it), then `apply(x, peaks, out)`, the gain those peaks call for, both allocating nothing: between them a peak may come from elsewhere (the loudest of linked channels). `end()` returns what the line still holds and empties it. `settings`: Float64Array(2), the ceiling (linear) and the release coefficient, read each block. */
export function limiterLine(options: LimiterOptions, settings: Float64Array): { run(x: Float32Array, out: Float32Array): number, level(x: Float32Array, peaks: Float64Array): void, apply(x: Float32Array, peaks: Float64Array, out: Float32Array): number, end(): Float32Array }
