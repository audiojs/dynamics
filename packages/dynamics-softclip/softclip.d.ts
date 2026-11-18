/** Static waveshaping — no envelope, no time state, optional anti-aliased oversampling. */
export interface SoftclipOptions {
  /** transfer curve, default 'tanh' */
  curve?: 'tanh' | 'atan' | 'cubic' | 'sin' | 'hard'
  /** input pre-gain, default 1 */
  drive?: number
  /** output asymptote, default 1 */
  ceiling?: number
  /** anti-aliased oversampling factor; 1 is the exact non-oversampled path (no resampling, zero cost), default 1 */
  oversample?: 1 | 2 | 4 | 8
  /** Hz, sample rate — only used when `oversample > 1`, default 44100 */
  fs?: number
}

/** Process a whole buffer. Returns a new Float32Array of the same length (never mutates `data`). */
export default function softclip(data: Float32Array, options?: SoftclipOptions): Float32Array
/** Streaming form: returns a writer — call with a chunk to process it, call with no argument to flush. When `oversample > 1`, chunks are buffered and shaped only on flush (sinc oversampling needs whole-signal context). */
export default function softclip(options?: SoftclipOptions): (chunk?: Float32Array) => Float32Array

/** { write, flush } streaming primitive underlying the default export's streaming form. */
export function softclipStream(options?: SoftclipOptions): { write(chunk: Float32Array): Float32Array, flush(): Float32Array }

/** Build the memoryless transfer function for `curve`/`drive`/`ceiling` (ignores `oversample`/`fs`). */
export function shaper(options?: SoftclipOptions): (x: number) => number

/** The curves, in the order softclipBlock's settings name them. */
export const CURVES: readonly ['tanh', 'atan', 'cubic', 'sin', 'hard']

/** An N-times oversampler for softclipBlock: the 32-tap Lanczos kernels @audio/resample-sinc reads with (up, one per phase, and down) and their sums; `latency`: the samples a sample comes out after it goes in, 15 + ⌈17/N⌉. */
export function oversampler(N: number): { N: number, up: Float64Array, upSum: Float64Array, down: Float64Array, downSum: Float64Array, latency: number }

/** One channel's state for softclipBlock: its positions, its last samples and its last points. */
export function softclipState(): { at: Float64Array, xs: Float64Array, ps: Float32Array }

/** The streaming form, allocating nothing; the manifest's path: one block of one channel into `out` (may be `x`, returned). `settings`: Float64Array(4), the curve (its index in CURVES), drive, ceiling, π·drive/2. `os`: oversampler(N), or null to shape each sample as it is; oversampled, `out` lags `x` by its `latency`, each sample what the whole-buffer call gives on the signal padded with silence. `lanes`: drive and ceiling for each sample, as a host's ramp moves them, from 0 and `stride`, written into `settings` sample by sample (an oversampled sample's points take its own); empty or absent, `settings`' own. */
export function softclipBlock(x: Float32Array, out: Float32Array, settings: Float64Array, os: ReturnType<typeof oversampler> | null, state: ReturnType<typeof softclipState>, lanes?: Float64Array, stride?: number): Float32Array
