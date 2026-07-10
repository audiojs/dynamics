// Generated from the audio.js manifest (params metadata is the source of truth).
// Regenerate: node tools/dts.js in @audio/compile. Do not edit by hand.

/** Automatable number — scalar, `t => value` fn, or breakpoint curve {t, v} */
type Auto = number | ((t: number) => number) | { t: number[], v: number[] }
/** Per-block param values as delivered by hosts (numbers arrive as 1-length Float32Array) */
type Live = Record<string, Float32Array | string | boolean>
type Ctx = { sampleRate: number, maxBlockSize: number, maxChannels: number, currentTime: number, duration?: number, events?: readonly any[], emit?: (name: string, ...args: any[]) => void, [k: string]: unknown }
type Process = (inputs: Float32Array[][], outputs: Float32Array[][], params: Live) => void

/** Chainable-host options for 'gate' */
export interface GateOptions {
  /** -80..0 dB (default -40) */
  "threshold"?: Auto
  /** -90..0 dB (default -46) */
  "closeThreshold"?: Auto
  /** -90..0 dB (default -60) */
  "range"?: Auto
  /** 0..500 ms (default 10) */
  "hold"?: Auto
  /** 0.01..100 ms (default 0.1) */
  "attack"?: Auto
  /** 1..1000 ms (default 100) */
  "release"?: Auto
  /** 0..50 ms (default 0) */
  "lookahead"?: Auto
  at?: number | string
  duration?: number | string
}

export declare const gate: {
  (ctx: Ctx): Process
  channels: "any"
  latency: (ctx: { sampleRate: number, params: Live }) => number
  tail: 0
  params: {
    /** -80..0 dB (default -40) [restart] */
    "threshold": { type: "number", default: -40 }
    /** -90..0 dB (default -46) [restart] */
    "closeThreshold": { type: "number", default: -46 }
    /** -90..0 dB (default -60) [restart] */
    "range": { type: "number", default: -60 }
    /** 0..500 ms (default 10) [restart] */
    "hold": { type: "number", default: 10 }
    /** 0.01..100 ms (default 0.1) [restart] */
    "attack": { type: "number", default: 0.1 }
    /** 1..1000 ms (default 100) [restart] */
    "release": { type: "number", default: 100 }
    /** 0..50 ms (default 0) [restart] */
    "lookahead": { type: "number", default: 0 }
  }
}
