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
