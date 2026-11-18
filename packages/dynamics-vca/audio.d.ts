// Generated from the audio.js manifest (params metadata is the source of truth).
// Regenerate: node tools/dts.js in @audio/compile. Do not edit by hand.

/** Automatable number — scalar, `t => value` fn, or breakpoint curve {t, v} */
type Auto = number | ((t: number) => number) | { t: number[], v: number[] }
/** Per-block param values as delivered by hosts (numbers arrive as 1-length Float32Array) */
type Live = Record<string, Float32Array | string | boolean>
type Ctx = { sampleRate: number, maxBlockSize: number, maxChannels: number, currentTime: number, duration?: number, events?: readonly any[], emit?: (name: string, ...args: any[]) => void, [k: string]: unknown }
type Process = (inputs: Float32Array[][], outputs: Float32Array[][], params: Live) => void

/** Chainable-host options for 'vca' */
export interface VcaOptions {
  /** -60..0 dB (default -20) */
  "threshold"?: Auto
  /** 1..20 (default 4) */
  "ratio"?: Auto
  /** 0..12 dB (default 1) */
  "knee"?: Auto
  /** 0.1..100 ms (default 1) */
  "attack"?: Auto
  /** 20..2000 ms (default 150) */
  "release"?: Auto
  /** -12..24 dB (default 0) */
  "makeup"?: Auto
  /** 0..1 (default 0) */
  "link"?: Auto
  at?: number | string
  duration?: number | string
}

export declare const vca: {
  (ctx: Ctx): Process
  channels: {"inputs":[{"channels":"any"},{"channels":"any","name":"key"}],"outputs":"any"}
  tail: 0
  params: {
    /** -60..0 dB (default -20) */
    "threshold": { type: "number", default: -20 }
    /** 1..20 (default 4) */
    "ratio": { type: "number", default: 4 }
    /** 0..12 dB (default 1) */
    "knee": { type: "number", default: 1 }
    /** 0.1..100 ms (default 1) */
    "attack": { type: "number", default: 1 }
    /** 20..2000 ms (default 150) */
    "release": { type: "number", default: 150 }
    /** -12..24 dB (default 0) */
    "makeup": { type: "number", default: 0 }
    /** 0..1 (default 0) */
    "link": { type: "number", default: 0 }
  }
}
