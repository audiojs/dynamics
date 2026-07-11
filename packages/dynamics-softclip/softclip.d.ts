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
