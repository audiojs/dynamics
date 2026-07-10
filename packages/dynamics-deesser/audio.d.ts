// Generated from the audio.js manifest (params metadata is the source of truth).
// Regenerate: node tools/dts.js in @audio/compile. Do not edit by hand.

/** Automatable number — scalar, `t => value` fn, or breakpoint curve {t, v} */
type Auto = number | ((t: number) => number) | { t: number[], v: number[] }
/** Per-block param values as delivered by hosts (numbers arrive as 1-length Float32Array) */
type Live = Record<string, Float32Array | string | boolean>
type Ctx = { sampleRate: number, maxBlockSize: number, maxChannels: number, currentTime: number, duration?: number, events?: readonly any[], emit?: (name: string, ...args: any[]) => void, [k: string]: unknown }
type Process = (inputs: Float32Array[][], outputs: Float32Array[][], params: Live) => void

/** Chainable-host options for 'deesser' */
export interface DeesserOptions {
  /** default "broadband" */
  "mode"?: "broadband" | "band"
  /** 2000..16000 Hz (default 6500) */
  "freq"?: Auto
  /** 0.3..10 (default 2) */
  "q"?: Auto
  /** -60..0 dB (default -20) */
  "threshold"?: Auto
  /** 1..20 (default 4) */
  "ratio"?: Auto
  /** 0..24 dB (default 6) */
  "knee"?: Auto
  /** 0.1..100 ms (default 1) */
  "attack"?: Auto
  /** 1..1000 ms (default 40) */
  "release"?: Auto
  at?: number | string
  duration?: number | string
}

export declare const deesser: {
  (ctx: Ctx): Process
  channels: "any"
  params: {
    /** default "broadband" [restart] */
    "mode": { type: "enum", values: ["broadband","band"], default: "broadband" }
    /** 2000..16000 Hz (default 6500) [restart] */
    "freq": { type: "number", default: 6500 }
    /** 0.3..10 (default 2) [restart] */
    "q": { type: "number", default: 2 }
    /** -60..0 dB (default -20) [restart] */
    "threshold": { type: "number", default: -20 }
    /** 1..20 (default 4) [restart] */
    "ratio": { type: "number", default: 4 }
    /** 0..24 dB (default 6) [restart] */
    "knee": { type: "number", default: 6 }
    /** 0.1..100 ms (default 1) [restart] */
    "attack": { type: "number", default: 1 }
    /** 1..1000 ms (default 40) [restart] */
    "release": { type: "number", default: 40 }
  }
}
