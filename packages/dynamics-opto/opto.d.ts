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

/** One block of one channel into `out` (may be `x`), allocating nothing once its scratch is as long as the block; optoLevel then optoGain. `state`: Float64Array(5), the RMS follower, the gain reduction (dB), the T4 memory, the window's sum and position; `ring`: the window's squares. `settings`: Float64Array(9), threshold, ratio, knee, makeup (dB), the attack coefficient, the follower's release coefficient, the memory's coefficient, the nominal release (ms), the sample rate. */
export function optoBlock(x: Float32Array, out: Float32Array, state: Float64Array, ring: Float32Array, settings: Float64Array): Float32Array

/** optoBlock's follower, allocating nothing; the manifest's path: its level after each sample into `level` (as long as `x` or longer), linear. Between it and optoGain a level may come from elsewhere: a key, the loudest of linked channels. */
export function optoLevel(x: Float32Array, level: Float64Array, state: Float64Array, ring: Float32Array, settings: Float64Array): void

/** optoBlock's gain, allocating nothing; the manifest's path: `x` into `out` (may be `x`, returned), each sample by the gain reduction its level in `level` calls for, smoothed, its release stretched by the T4 memory. `makeup`: the makeup (dB) for each sample (as long as `x` or longer), as a host's ramp moves it; empty or absent, `settings`'s. */
export function optoGain(x: Float32Array, level: Float64Array, out: Float32Array, state: Float64Array, settings: Float64Array, makeup?: Float64Array): Float32Array
