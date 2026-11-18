/** SoX-style multi-segment compander — arbitrary piecewise-linear transfer in dB (compression, expansion and gating under one curve). */
export interface CompandOptions {
  /** `[inDb, outDb]` pairs (any order — sorted internally); points below the identity line compress, above it expand, default `[[-90,-90],[-60,-60],[-20,-20],[0,-8]]` */
  points?: [number, number][]
  /** ms, default 5 */
  attack?: number
  /** ms, default 200 */
  release?: number
  /** envelope detector, passed through to the underlying follower, default 'peak' */
  detector?: 'peak' | 'rms'
  /** RMS window, samples, default 256 (only used when detector is 'rms') */
  rmsWindow?: number
  /** sample rate, Hz, default 44100 (alias `fs`) */
  sampleRate?: number
  /** alias of sampleRate, Hz, default 44100 */
  fs?: number
}

/** Process a whole buffer. Returns a new Float32Array of the same length. */
export default function compand(data: Float32Array, options?: CompandOptions): Float32Array
/** Streaming form: returns a writer — call with a chunk to process it, call with no argument to flush. */
export default function compand(options?: CompandOptions): (chunk?: Float32Array) => Float32Array

/** { write, flush } streaming primitive underlying the default export's streaming form. */
export function compandStream(options?: CompandOptions): { write(chunk: Float32Array): Float32Array, flush(): Float32Array }

/** One block of one channel into `out` (may be `x`), allocating nothing; the manifest's path. `state`: Float64Array(3), the follower, the RMS window's sum and position; `ring`: the window's squares (empty for peak). `settings`: Float64Array(3), the follower's attack and release coefficients, 1 for RMS. `points`: inDb, outDb, … sorted by inDb. `outs`: each point's outDb for each sample, as a host's ramp moves them, point j's from j·`stride`, written into `points` sample by sample; empty or absent, `points`' own. */
export function compandBlock(x: Float32Array, out: Float32Array, state: Float64Array, ring: Float32Array, settings: Float64Array, points: Float64Array, outs?: Float64Array, stride?: number): Float32Array
