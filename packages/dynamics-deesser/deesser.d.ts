/** De-esser — the sibilance band's level over the voice body's (dB, any recording level) drives a cut held within `range`: broadband gain, or a peaking-EQ cut at `fc` ('band'). */
export interface DeesserOptions {
  /** 'broadband' (the whole sound dips while an 's' lasts) or 'band' (a peaking EQ at `fc` cuts only the sibilance band), default 'broadband' */
  mode?: 'broadband' | 'band'
  /** Hz, sibilance center: the band watched (and, in band mode, cut); the voice body is below fc/2. Default 6500 */
  fc?: number
  /** @deprecated former name of `fc` */
  freq?: number
  /** width of the sibilance band, watched and (band mode) cut, default 2 (broadband) / 1.4 (band) */
  Q?: number
  /** @deprecated former name of `Q` */
  q?: number
  /** dB of the sibilance band over the voice body at which the cut starts, default 0 (not a level: the same at any recording level) */
  threshold?: number
  /** default 4 */
  ratio?: number
  /** dB, the deepest cut (sign ignored), default -6 */
  range?: number
  /** dB, soft-knee width, default 6 */
  knee?: number
  /** ms, default 1 */
  attack?: number
  /** ms, default 15 */
  release?: number
  /** samples, EQ-gain recompute block, band mode only, default 64 */
  block?: number
  /** @deprecated ignored: the detector is the sibilance band's RMS over the voice body's */
  detector?: 'peak' | 'rms'
  /** sample rate, Hz, default 44100 (no `fs` alias — this atom reads `sampleRate` only) */
  sampleRate?: number
}

/** Process a whole buffer. Returns a new Float32Array of the same length. */
export default function deesser(data: Float32Array, options?: DeesserOptions): Float32Array
/** Streaming form: returns a writer — call with a chunk to process it, call with no argument to flush. */
export default function deesser(options?: DeesserOptions): (chunk?: Float32Array) => Float32Array

/** { write, flush } streaming primitive underlying the default export's streaming form. */
export function deesserStream(options?: DeesserOptions): { write(chunk: Float32Array): Float32Array, flush(): Float32Array }
