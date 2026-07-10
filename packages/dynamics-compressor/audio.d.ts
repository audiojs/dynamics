// Generated from the audio.js manifest (params metadata is the source of truth).
// Regenerate: node tools/dts.js in @audio/compile. Do not edit by hand.

/** Automatable number — scalar, `t => value` fn, or breakpoint curve {t, v} */
type Auto = number | ((t: number) => number) | { t: number[], v: number[] }
/** Per-block param values as delivered by hosts (numbers arrive as 1-length Float32Array) */
type Live = Record<string, Float32Array | string | boolean>
type Ctx = { sampleRate: number, maxBlockSize: number, maxChannels: number, currentTime: number, duration?: number, events?: readonly any[], emit?: (name: string, ...args: any[]) => void, [k: string]: unknown }
type Process = (inputs: Float32Array[][], outputs: Float32Array[][], params: Live) => void

/** Chainable-host options for 'compressor' */
export interface CompressorOptions {
  /** -60..0 dB (default -20) */
  "threshold"?: Auto
  /** 1..20 (default 4) */
  "ratio"?: Auto
  /** 0..24 dB (default 6) */
  "knee"?: Auto
  /** -12..24 dB (default 0) */
  "makeup"?: Auto
  /** -80..0 dB (default -40) */
  "upThreshold"?: Auto
  /** 1..20 (default 1) */
  "upRatio"?: Auto
  /** 0..24 dB (default 6) */
  "upKnee"?: Auto
  /** 0..40 dB (default 12) */
  "upRange"?: Auto
  /** 0.1..100 ms (default 5) */
  "attack"?: Auto
  /** 1..1000 ms (default 100) */
  "release"?: Auto
  at?: number | string
  duration?: number | string
}

export declare const compressor: {
  (ctx: Ctx): Process
  channels: "any"
  tail: 0.3
  params: {
    /** -60..0 dB (default -20) */
    "threshold": { type: "number", default: -20 }
    /** 1..20 (default 4) */
    "ratio": { type: "number", default: 4 }
    /** 0..24 dB (default 6) */
    "knee": { type: "number", default: 6 }
    /** -12..24 dB (default 0) */
    "makeup": { type: "number", default: 0 }
    /** -80..0 dB (default -40) */
    "upThreshold": { type: "number", default: -40 }
    /** 1..20 (default 1) */
    "upRatio": { type: "number", default: 1 }
    /** 0..24 dB (default 6) */
    "upKnee": { type: "number", default: 6 }
    /** 0..40 dB (default 12) */
    "upRange": { type: "number", default: 12 }
    /** 0.1..100 ms (default 5) [restart] */
    "attack": { type: "number", default: 5 }
    /** 1..1000 ms (default 100) [restart] */
    "release": { type: "number", default: 100 }
  }
}
