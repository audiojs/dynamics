/** Feed-forward soft-knee compressor, gain reduction smoothed in the log domain (Giannoulis, Massberg & Reiss 2012), with an optional upward-compression half. */
export interface CompressorOptions {
  /** dB, downward-compression threshold, default -20 */
  threshold?: number
  /** downward ratio, default 4 */
  ratio?: number
  /** dB, soft-knee width, default 6 */
  knee?: number
  /** ms, default 5 */
  attack?: number
  /** ms, default 100 */
  release?: number
  /** dB, output makeup gain, default 0 */
  makeup?: number
  /** scales the summed up+down gain before makeup (OTT "Depth" macro; 0 = identity), default 1 */
  depth?: number
  /** dB, upward-compression threshold; null disables upward compression, default null */
  upThreshold?: number | null
  /** upward ratio (1 is a mathematical no-op), default 2 */
  upRatio?: number
  /** dB, upward soft-knee width, default 6 */
  upKnee?: number
  /** dB, max upward lift, default 12 */
  upRange?: number
  /** envelope detector, default 'peak' */
  detector?: 'peak' | 'rms'
  /** RMS window, samples, default 256 (only used when detector is 'rms') */
  rmsWindow?: number
  /** sample rate, Hz, default 44100 (alias `fs`) */
  sampleRate?: number
  /** alias of sampleRate, Hz, default 44100 */
  fs?: number
}

/** Process a whole buffer. Returns a new Float32Array of the same length. */
export default function compressor(data: Float32Array, options?: CompressorOptions): Float32Array
/** Streaming form: returns a writer — call with a chunk to process it, call with no argument to flush. */
export default function compressor(options?: CompressorOptions): (chunk?: Float32Array) => Float32Array

/** { write, flush } streaming primitive underlying the default export's streaming form. */
export function compressorStream(options?: CompressorOptions): { write(chunk: Float32Array): Float32Array, flush(): Float32Array }

/** Soft-knee downward compression curve. Returns gain reduction in dB (≤ 0). */
export function compressorGain(levelDb: number, threshold: number, ratio: number, kneeDb: number): number

/** Soft-knee upward compression curve — the below-threshold complement of compressorGain. Returns gain lift in dB (≥ 0), clamped to rangeDb. */
export function upwardGain(levelDb: number, threshold: number, ratio: number, kneeDb: number, rangeDb?: number): number

/** Static gain, dB, at a level in dB: the downward curve plus the upward lift when `upThreshold` is set. */
export function gainDb(levelDb: number, curve: { threshold: number, ratio: number, knee: number, upThreshold?: number | null, upRatio: number, upKnee: number, upRange: number }): number

/** Level in dB per sample: the instantaneous peak, or the RMS of the last `win` samples. */
export function detector(type?: 'peak' | 'rms', win?: number): (x: number) => number

/** Smooth decoupled peak detector (Giannoulis et al. 2012, eq. 17) on gain reduction in dB. */
export function smoother(attack: number, release: number, sampleRate: number): (reductionDb: number) => number

/** One channel's running state for `compress`: the smoother's coefficients and poles, the RMS window when `type` is 'rms'. */
export interface CompressorState { aA: number, aR: number, y1: number, y: number, rms: boolean, n: number, buf: Float64Array, sum: number, i: number }
export function compressorState(attack: number, release: number, sampleRate: number, type?: 'peak' | 'rms', win?: number): CompressorState

/** Compress block `x` into `out` (returned), carrying `state` across blocks: detector, gain curve and smoother fused. */
export function compress(x: Float32Array, out: Float32Array, state: CompressorState, curve: { threshold: number, ratio: number, knee: number, upThreshold?: number | null, upRatio: number, upKnee: number, upRange: number }, depth?: number, makeup?: number): Float32Array

/** `compress` on typed arrays, allocating nothing once its scratch is as long as the block. `poles`: Float64Array(4), the smoother's y₁ and y, the RMS window's sum and position; `buf`: the window's squares (empty for peak). `settings`: Float64Array(14), threshold, ratio, knee, 1 for upward on, upThreshold, upRatio, upKnee, upRange, depth, makeup, the smoother's attack and release coefficients, 1 for RMS, the window's length. It is compressLevel then compressGain. */
export function compressBlock(x: Float32Array, out: Float32Array, poles: Float64Array, settings: Float64Array, buf: Float64Array): Float32Array

/** compressBlock's detector, allocating nothing; the manifest's path: each sample's level into `level` (as long as `x` or longer), |x| or the RMS window's mean square, linear. Between it and compressGain a level may come from elsewhere: a key, the loudest of linked channels. */
export function compressLevel(x: Float32Array, level: Float64Array, poles: Float64Array, settings: Float64Array, buf: Float64Array): void

/** compressBlock's gain computer and smoother, allocating nothing; the manifest's path: `x` into `out` (may be `x`, returned), each sample by the gain of its level in `level`. `makeup`: the makeup (dB) for each sample (as long as `x` or longer), as a host's ramp moves it; empty or absent, `settings`'s. */
export function compressGain(x: Float32Array, level: Float64Array, out: Float32Array, poles: Float64Array, settings: Float64Array, makeup?: Float64Array): Float32Array
