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
