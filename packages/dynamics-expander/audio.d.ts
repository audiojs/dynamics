// Generated from the audio.js manifest (params metadata is the source of truth).
// Regenerate: node tools/dts.js in @audio/compile. Do not edit by hand.

/** Automatable number — scalar, `t => value` fn, or breakpoint curve {t, v} */
type Auto = number | ((t: number) => number) | { t: number[], v: number[] }
/** Per-block param values as delivered by hosts (numbers arrive as 1-length Float32Array) */
type Live = Record<string, Float32Array | string | boolean>
type Ctx = { sampleRate: number, maxBlockSize: number, maxChannels: number, currentTime: number, duration?: number, events?: readonly any[], emit?: (name: string, ...args: any[]) => void, [k: string]: unknown }
type Process = (inputs: Float32Array[][], outputs: Float32Array[][], params: Live) => void

/** Chainable-host options for 'expander' */
export interface ExpanderOptions {
  /** default "downward" */
  "mode"?: "downward" | "upward"
  /** -80..0 dB (default -30) */
  "threshold"?: Auto
  /** 1..20 (default 2) */
  "ratio"?: Auto
  /** 0..24 dB (default 6) */
  "knee"?: Auto
  /** 0..90 dB (default 40) */
  "range"?: Auto
  /** 0.1..100 ms (default 5) */
  "attack"?: Auto
  /** 1..1000 ms (default 50) */
  "release"?: Auto
  at?: number | string
  duration?: number | string
}

export declare const expander: {
  (ctx: Ctx): Process
  channels: "any"
  tail: 0
  params: {
    /** default "downward" */
    "mode": { type: "enum", values: ["downward","upward"], default: "downward" }
    /** -80..0 dB (default -30) */
    "threshold": { type: "number", default: -30 }
    /** 1..20 (default 2) */
    "ratio": { type: "number", default: 2 }
    /** 0..24 dB (default 6) */
    "knee": { type: "number", default: 6 }
    /** 0..90 dB (default 40) */
    "range": { type: "number", default: 40 }
    /** 0.1..100 ms (default 5) [restart] */
    "attack": { type: "number", default: 5 }
    /** 1..1000 ms (default 50) [restart] */
    "release": { type: "number", default: 50 }
  }
}
