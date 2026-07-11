/** Classical de-limiter — transient-gated upward expansion restoring crest a brickwall limiter flattened. */
export interface UnlimitOptions {
  /** dB, max crest restoration (range 0-18), default 6 */
  amount?: number
  /** scales the deficit-driven restoration (1 = restore attacks to `crestTarget`); in `adaptive: false` mode, dB of lift per dB of transientness, default 1 */
  drive?: number
  /** deficit mode (default) vs. raw proportional transient-following (`false`, a transient exaggerator), default true */
  adaptive?: boolean
  /** dB of transientness a healthy attack is expected to show; flattened attacks get lifted by what they're missing, default 10 */
  crestTarget?: number
  /** dBFS, post guard so restored peaks don't exceed it; null allows peaks to exceed 0 dBFS by design, default null */
  ceiling?: number | null
  /** ms, default 0.5 */
  fastAttack?: number
  /** ms, default 20 */
  fastRelease?: number
  /** ms, default 20 */
  slowAttack?: number
  /** ms, default 200 */
  slowRelease?: number
  /** sample rate, Hz, default 44100 (no `fs` alias — this atom reads `sampleRate` only) */
  sampleRate?: number
}

/** Process a whole buffer. Returns a new Float32Array of the same length. */
export default function unlimit(data: Float32Array, options?: UnlimitOptions): Float32Array
/** Streaming form: returns a writer — call with a chunk to process it, call with no argument to flush. */
export default function unlimit(options?: UnlimitOptions): (chunk?: Float32Array) => Float32Array

/** { write, flush } streaming primitive underlying the default export's streaming form. */
export function unlimitStream(options?: UnlimitOptions): { write(chunk: Float32Array): Float32Array, flush(): Float32Array }

/** adaptive:false pure mapping: transientness (fast-over-slow envelope gap, dB) → target lift (dB), before ballistic smoothing. */
export function unlimitGain(fastDb: number, slowDb: number, amount: number, drive: number): number

/** adaptive (default) pure mapping: transient deficit (crestTarget − peak-held transientness) → target lift (dB), gated by onset presence. */
export function unlimitDeficitGain(transientnessDb: number, crestTarget: number, amount: number, drive: number): number
