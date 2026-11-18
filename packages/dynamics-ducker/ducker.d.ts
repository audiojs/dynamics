/** External-sidechain compressor — main signal's gain tracks the level of a separate side signal. */
export interface DuckerOptions {
  /** dB, on side level, default -30 */
  threshold?: number
  /** default 4 */
  ratio?: number
  /** dB, default 6 */
  knee?: number
  /** dB, max reduction, default -24 */
  range?: number
  /** ms, default 20 */
  attack?: number
  /** ms, default 300 */
  release?: number
  /** side envelope detector, passed through to the underlying follower, default 'peak' */
  detector?: 'peak' | 'rms'
  /** RMS window, samples, default 256 (only used when detector is 'rms') */
  rmsWindow?: number
  /** sample rate, Hz, default 44100 (alias `fs`) */
  sampleRate?: number
  /** alias of sampleRate, Hz, default 44100 */
  fs?: number
}

/** Process a whole main+side buffer pair. Returns a new Float32Array the length of `main`. */
export default function ducker(main: Float32Array, side: Float32Array, options?: DuckerOptions): Float32Array
/** Streaming form: returns a writer — call with (main, side) chunks to process them (side defaults to main if omitted), call with no argument to flush. */
export default function ducker(options?: DuckerOptions): (main?: Float32Array, side?: Float32Array) => Float32Array

/** { write, flush } streaming primitive underlying the default export's streaming form. */
export function duckerStream(options?: DuckerOptions): { write(main: Float32Array, side: Float32Array): Float32Array, flush(): Float32Array }

/** One block of one channel into `out` (may be `x`), `x` turned down by `key`'s level, over as many samples as both hold, allocating nothing; the manifest's path. `state`: Float64Array(3), the follower, the RMS window's sum and position; `ring`: the window's squares (empty for peak). `settings`: Float64Array(7), threshold, ratio, knee, range (dB), the follower's attack and release coefficients, 1 for RMS. `lanes`: threshold, ratio, knee and range for each sample, as a host's ramp moves them, from 0, `stride`, 2·`stride` and 3·`stride`; empty or absent, `settings`'s. */
export function duckBlock(x: Float32Array, key: Float32Array, out: Float32Array, state: Float64Array, ring: Float32Array, settings: Float64Array, lanes?: Float64Array, stride?: number): Float32Array
