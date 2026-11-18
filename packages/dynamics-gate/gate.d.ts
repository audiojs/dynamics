/** Noise gate — hysteresis open/close thresholds, hold, look-ahead, smoothed gain transitions. */
export interface GateOptions {
  /** dB, opens above this level, default -40 */
  threshold?: number
  /** dB, closes below this level (hysteresis band); clamped to at most `threshold`, default `threshold - 6` */
  closeThreshold?: number
  /** dB, attenuation applied while closed, default -60 */
  range?: number
  /** ms, keeps the gate open after level drops below the trigger, default 10 */
  hold?: number
  /** ms, gain-opening smoothing, default 0.1 */
  attack?: number
  /** ms, gain-closing smoothing, default 100 */
  release?: number
  /** ms, detection runs this far ahead of emission (adds equal output delay), default 0 */
  lookahead?: number
  /** trigger envelope detector, passed through to the underlying follower, default 'peak' */
  detector?: 'peak' | 'rms'
  /** sample rate, Hz, default 44100 (no `fs` alias — this atom reads `sampleRate` only) */
  sampleRate?: number
}

/** Process a whole buffer. Returns a new Float32Array — with lookahead, batch calls stay sample-aligned (write+flush covers the full signal). */
export default function gate(data: Float32Array, options?: GateOptions): Float32Array
/** Streaming form: returns a writer — call with a chunk to process it, call with no argument to flush. */
export default function gate(options?: GateOptions): (chunk?: Float32Array) => Float32Array

/** { write, flush } streaming primitive underlying the default export's streaming form. */
export function gateStream(options?: GateOptions): { write(chunk: Float32Array): Float32Array, flush(): Float32Array }

/** One channel's state for gateBlock, the gate closed at gain `closed` (linear). */
export function gateState(closed: number): Float64Array

/** One block of one channel into `out` (may be `x`), allocating nothing once its scratch is as long as the block; gateLevel then gateGain. With a look-ahead `out` lags `x` by its length, and while the line first fills nothing comes out (0 there): returns how many samples that was. `ring`: the RMS window's squares (empty for peak); `line`: the delay line (empty for none). `settings`: Float64Array(9), the open, close and closed gains (linear), the gain's attack and release coefficients, the hold (samples), the trigger follower's attack and release coefficients, 1 for RMS. */
export function gateBlock(x: Float32Array, out: Float32Array, state: Float64Array, ring: Float32Array, line: Float32Array, settings: Float64Array): number

/** gateBlock's trigger follower, allocating nothing; the manifest's path: its level after each sample into `level` (as long as `x` or longer), linear. Between it and gateGain a level may come from elsewhere: a key, the loudest of linked channels. */
export function gateLevel(x: Float32Array, level: Float64Array, state: Float64Array, ring: Float32Array, settings: Float64Array): void

/** gateBlock's gate (hysteresis, hold, the gain, the delay line), allocating nothing; the manifest's path: `x` into `out` (may be `x`) by each sample's trigger level in `level`; returns the samples swallowed while the line first fills. `closed`: the closed gain (linear) for each sample, as a host's ramp of the range moves it; empty or absent, `settings`'s. */
export function gateGain(x: Float32Array, level: Float64Array, out: Float32Array, state: Float64Array, line: Float32Array, settings: Float64Array, closed?: Float64Array): number
