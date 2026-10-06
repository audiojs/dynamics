/** De-esser: the sibilance band's level over the voice body's (dB, any recording level) drives a cut held within `range`, read `lookahead` ms ahead: on the band over `split` (linear phase, default), on a band at `fc` ('band'), or broadband. */
export interface DeesserOptions {
  /** 'split' (only the band over `split` moves, linear phase), 'band' (only a band at `fc`, `Q` wide), 'broadband' (the whole sound dips while an 's' lasts); default 'split' */
  mode?: 'split' | 'band' | 'broadband'
  /** Hz, where the cut band starts in split and broadband modes (watched over it, against the voice body under 3.5 kHz), default 3500 */
  split?: number
  /** Hz, band mode: the cut band's centre, default 6500 */
  fc?: number
  /** @deprecated former name of `fc` */
  freq?: number
  /** band mode: the band's width, as a peaking EQ's Q (RBJ), default 1.4 (about an octave) */
  Q?: number
  /** @deprecated former name of `Q` */
  q?: number
  /** dB of the sibilance band over the voice body at which the cut starts, default 0 (not a level: the same at any recording level) */
  threshold?: number
  /** default 4 */
  ratio?: number
  /** dB, the deepest cut (sign ignored), default -8 */
  range?: number
  /** dB, soft-knee width, default 6 */
  knee?: number
  /** ms, default 1 */
  attack?: number
  /** ms, default 15 */
  release?: number
  /** ms the sound is read ahead of what is cut (the output's delay, never under 1.5 ms), default 5 */
  lookahead?: number
  /** @deprecated ignored: band mode is a linear-phase band, no EQ to recompute */
  block?: number
  /** @deprecated ignored: the detector is the sibilance band's RMS over the voice body's */
  detector?: 'peak' | 'rms'
  /** sample rate, Hz, default 44100 (no `fs` alias — this atom reads `sampleRate` only) */
  sampleRate?: number
}

/** Process a whole buffer. Returns a new Float32Array of the same length, aligned with the input. */
export default function deesser(data: Float32Array, options?: DeesserOptions): Float32Array
/** Streaming form: returns a writer: call with a chunk to process it (as many samples come back, `latency` late), call with no argument to flush the last `latency`. */
export default function deesser(options?: DeesserOptions): (chunk?: Float32Array) => Float32Array

/** { write, flush, latency } streaming primitive underlying the default export's streaming form. */
export function deesserStream(options?: DeesserOptions): { latency: number, write(chunk: Float32Array): Float32Array, flush(): Float32Array }

/** The output's delay in samples at a rate and look-ahead (ms): the look-ahead, never under the split's 1.5 ms. */
export function latency(sampleRate?: number, lookahead?: number): number
