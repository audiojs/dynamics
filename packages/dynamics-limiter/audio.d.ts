// Generated from the audio.js manifest (params metadata is the source of truth).
// Regenerate: node tools/dts.js in @audio/compile. Do not edit by hand.

/** Automatable number — scalar, `t => value` fn, or breakpoint curve {t, v} */
type Auto = number | ((t: number) => number) | { t: number[], v: number[] }
/** Per-block param values as delivered by hosts (numbers arrive as 1-length Float32Array) */
type Live = Record<string, Float32Array | string | boolean>
type Ctx = { sampleRate: number, maxBlockSize: number, maxChannels: number, currentTime: number, duration?: number, events?: readonly any[], emit?: (name: string, ...args: any[]) => void, [k: string]: unknown }
type Process = (inputs: Float32Array[][], outputs: Float32Array[][], params: Live) => void

/** Chainable-host options for 'limiter' */
export interface LimiterOptions {
  /** -30..0 dB (default -0.3) */
  "ceiling"?: Auto
  /** 0.1..20 ms (default 5) */
  "lookahead"?: Auto
  /** 1..1000 ms (default 50) */
  "release"?: Auto
  /** default false */
  "truePeak"?: boolean
  /** 0..1 (default 0) */
  "link"?: Auto
  at?: number | string
  duration?: number | string
}

export declare const limiter: {
  (ctx: Ctx): Process
  channels: "any"
  latency: (at: { sampleRate: number, params: Live, buffers: {} }) => number
  params: {
    /** -30..0 dB (default -0.3) */
    "ceiling": { type: "number", default: -0.3 }
    /** 0.1..20 ms (default 5) [restart] */
    "lookahead": { type: "number", default: 5 }
    /** 1..1000 ms (default 50) */
    "release": { type: "number", default: 50 }
    /** default false [restart] */
    "truePeak": { type: "bool", default: false }
    /** 0..1 (default 0) */
    "link": { type: "number", default: 0 }
  }
}
