type Writer = (chunk?: Float32Array) => Float32Array
type Writer2 = (main?: Float32Array, side?: Float32Array) => Float32Array

export interface EnvelopeOpts {
  sampleRate?: number
  attack?: number       // ms
  release?: number      // ms
  detector?: 'peak' | 'rms'
  rmsWindow?: number    // samples
}

export interface CompressorOpts extends EnvelopeOpts {
  threshold?: number    // dB
  ratio?: number
  knee?: number         // dB
  makeup?: number       // dB
  depth?: number        // scales the summed up+down gain before makeup (OTT "Depth"), default 1
  upThreshold?: number | null   // dB; null (default) disables upward compression
  upRatio?: number      // default 2
  upKnee?: number       // dB, default 6
  upRange?: number      // dB, max upward lift, default 12
}

export interface LimiterOpts {
  sampleRate?: number
  ceiling?: number      // dB (e.g. -0.3)
  lookahead?: number    // ms
  release?: number      // ms
}

export interface GateOpts extends EnvelopeOpts {
  threshold?: number    // dB
  range?: number        // dB reduction when closed (e.g. -60)
  hold?: number         // ms
}

export interface ExpanderOpts extends EnvelopeOpts {
  mode?: 'downward' | 'upward'   // default 'downward'
  threshold?: number
  ratio?: number
  knee?: number
  range?: number        // dB; downward: max reduction, negative (e.g. -40); upward: max lift, positive (e.g. 20)
}

export interface UnlimitOpts {
  sampleRate?: number
  amount?: number        // dB, max crest restoration (default 0.5, range 0-18)
  drive?: number         // dB of lift per dB of detected transientness (default 2)
  ceiling?: number | null   // dBFS; null (default): no post-lift guard, peaks may exceed 0 dBFS
  fastAttack?: number    // ms, transient-detector fast envelope (default 0.5)
  fastRelease?: number   // ms (default 20)
  slowAttack?: number    // ms, transient-detector slow envelope (default 20)
  slowRelease?: number   // ms (default 200)
}

export interface DeesserOpts extends EnvelopeOpts {
  freq?: number         // Hz, sibilance center
  q?: number
  threshold?: number
  ratio?: number
  knee?: number
}

export interface DuckerOpts extends EnvelopeOpts {
  threshold?: number
  ratio?: number
  knee?: number
  range?: number        // dB, max reduction
}

export interface SoftclipOpts {
  curve?: 'tanh' | 'atan' | 'cubic' | 'sin' | 'hard'
  drive?: number
  ceiling?: number
  fs?: number            // sample rate, used by oversample's resampler; default 44100
  oversample?: 1 | 2 | 4 | 8   // default 1 (exact non-oversampled behavior)
}

export interface CompandOpts extends EnvelopeOpts {
  points?: [number, number][]   // [[inDb, outDb], ...]
}

export declare const compressor: {
  (data: Float32Array, opts?: CompressorOpts): Float32Array
  (opts?: CompressorOpts): Writer
}

// Pure gain-curve functions (dB in, dB out) — the compressor kernel's building
// blocks, exposed for custom envelope-driven processing.
export declare function compressorGain(levelDb: number, threshold: number, ratio: number, kneeDb: number): number
export declare function upwardGain(levelDb: number, threshold: number, ratio: number, kneeDb: number, rangeDb?: number): number

export declare const limiter: {
  (data: Float32Array, opts?: LimiterOpts): Float32Array
  (opts?: LimiterOpts): Writer
}

export declare const gate: {
  (data: Float32Array, opts?: GateOpts): Float32Array
  (opts?: GateOpts): Writer
}

export declare const expander: {
  (data: Float32Array, opts?: ExpanderOpts): Float32Array
  (opts?: ExpanderOpts): Writer
}

// Upward expansion's pure gain curve (dB in, dB out) — see upwardGain for the
// compressor's below-threshold complement.
export declare function upwardExpanderGain(levelDb: number, threshold: number, ratio: number, kneeDb: number, rangeDb: number): number

export declare const unlimit: {
  (data: Float32Array, opts?: UnlimitOpts): Float32Array
  (opts?: UnlimitOpts): Writer
}

// Pure mapping: transientness (dB, fast envelope above slow) → target lift (dB),
// before ballistic smoothing. Built on upwardExpanderGain — see @audio/dynamics-unlimit
// for the knee-placement rationale (threshold pinned so r(0) = 0 exactly).
export declare function unlimitGain(fastDb: number, slowDb: number, amount: number, drive: number): number

export declare const deesser: {
  (data: Float32Array, opts?: DeesserOpts): Float32Array
  (opts?: DeesserOpts): Writer
}

export declare const ducker: {
  (main: Float32Array, side: Float32Array, opts?: DuckerOpts): Float32Array
  (opts?: DuckerOpts): Writer2
}

export declare const softclip: {
  (data: Float32Array, opts?: SoftclipOpts): Float32Array
  (opts?: SoftclipOpts): Writer
}

export declare const compand: {
  (data: Float32Array, opts?: CompandOpts): Float32Array
  (opts?: CompandOpts): Writer
}

export declare function envelope(opts?: EnvelopeOpts): (x: number) => number
