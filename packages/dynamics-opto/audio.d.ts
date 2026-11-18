// Generated from the audio.js manifest (params metadata is the source of truth).
// Regenerate: node tools/dts.js in @audio/compile. Do not edit by hand.

/** Automatable number — scalar, `t => value` fn, or breakpoint curve {t, v} */
type Auto = number | ((t: number) => number) | { t: number[], v: number[] }
/** Per-block param values as delivered by hosts (numbers arrive as 1-length Float32Array) */
type Live = Record<string, Float32Array | string | boolean>
type Ctx = { sampleRate: number, maxBlockSize: number, maxChannels: number, currentTime: number, duration?: number, events?: readonly any[], emit?: (name: string, ...args: any[]) => void, [k: string]: unknown }
type Process = (inputs: Float32Array[][], outputs: Float32Array[][], params: Live) => void

/** Chainable-host options for 'opto' */
export interface OptoOptions {
  /** -60..0 dB (default -20) */
  "threshold"?: Auto
  /** 1.5..6 (default 3) */
  "ratio"?: Auto
  /** 4..24 dB (default 10) */
  "knee"?: Auto
  /** 1..100 ms (default 10) */
  "attack"?: Auto
  /** -12..24 dB (default 0) */
  "makeup"?: Auto
  /** 0..1 (default 0) */
  "link"?: Auto
  at?: number | string
  duration?: number | string
}

export declare const opto: {
  (ctx: Ctx): Process
  channels: {"inputs":[{"channels":"any"},{"channels":"any","name":"key"}],"outputs":"any"}
  tail: 0
  params: {
    /** -60..0 dB (default -20) */
    "threshold": { type: "number", default: -20 }
    /** 1.5..6 (default 3) */
    "ratio": { type: "number", default: 3 }
    /** 4..24 dB (default 10) */
    "knee": { type: "number", default: 10 }
    /** 1..100 ms (default 10) */
    "attack": { type: "number", default: 10 }
    /** -12..24 dB (default 0) */
    "makeup": { type: "number", default: 0 }
    /** 0..1 (default 0) */
    "link": { type: "number", default: 0 }
  }
}
