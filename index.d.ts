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
  threshold?: number
  ratio?: number
  knee?: number
  range?: number        // dB, max reduction (e.g. -40)
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
}

export interface CompandOpts extends EnvelopeOpts {
  points?: [number, number][]   // [[inDb, outDb], ...]
}

export declare const compressor: {
  (data: Float32Array, opts?: CompressorOpts): Float32Array
  (opts?: CompressorOpts): Writer
}

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
