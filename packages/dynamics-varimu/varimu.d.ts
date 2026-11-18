/** Vari-Mu compressor model (Fairchild class) — feedback-topology detection, drive-dependent ratio, soft wide knee. */
export interface VarimuOptions {
  /** dB, default -22 */
  threshold?: number
  /** dB, wide knee, default 15 */
  knee?: number
  /** ms, default 25 */
  attack?: number
  /** ms, default 400 */
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

/** Process a whole buffer. Returns a new Float32Array of the same length. Ratio is derived from drive above threshold (mu = 1.8 + max(0, overDb) / 5) — not a settable option. */
export default function varimu(data: Float32Array, options?: VarimuOptions): Float32Array
/** Streaming form: returns a writer — call with a chunk to process it, call with no argument to flush. */
export default function varimu(options?: VarimuOptions): (chunk?: Float32Array) => Float32Array

/** { write, flush } streaming primitive underlying the default export's streaming form. */
export function varimuStream(options?: VarimuOptions): { write(chunk: Float32Array): Float32Array, flush(): Float32Array }

/** One block of one channel into `out` (may be `x`), allocating nothing; the manifest's path. `state`: Float64Array(4), the RMS follower, the gain reduction (dB), the window's sum and position; `ring`: the window's squares. `settings`: Float64Array(6), threshold, knee, makeup (dB), the attack coefficient, the gain's release coefficient, the follower's release coefficient. `makeup`: the makeup (dB) for each sample (as long as `x` or longer), as a host's ramp moves it; empty or absent, `settings`'s. The follower reads the output before makeup. */
export function varimuBlock(x: Float32Array, out: Float32Array, state: Float64Array, ring: Float32Array, settings: Float64Array, makeup?: Float64Array): Float32Array
