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

/** One block of one channel into `out` (may be `x`), allocating nothing once its scratch is as long as the block; fetLevel then fetGain. `state`: Float64Array(2), the peak follower and the gain reduction (dB). `settings`: Float64Array(8), threshold, ratio, knee, makeup (dB), the gain's attack and release coefficients, the follower's attack and release coefficients (α = e^(−1/(τ·fs))). */
export function fetBlock(x: Float32Array, out: Float32Array, state: Float64Array, settings: Float64Array): Float32Array

/** fetBlock's follower, allocating nothing; the manifest's path: its level after each sample into `level` (as long as `x` or longer), linear. Between it and fetGain a level may come from elsewhere: a key, the loudest of linked channels. */
export function fetLevel(x: Float32Array, level: Float64Array, state: Float64Array, settings: Float64Array): void

/** fetBlock's gain, allocating nothing; the manifest's path: `x` into `out` (may be `x`, returned), each sample by the gain reduction its level in `level` calls for, smoothed. `makeup`: the makeup (dB) for each sample (as long as `x` or longer), as a host's ramp moves it; empty or absent, `settings`'s. */
export function fetGain(x: Float32Array, level: Float64Array, out: Float32Array, state: Float64Array, settings: Float64Array, makeup?: Float64Array): Float32Array
