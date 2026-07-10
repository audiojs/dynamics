// Generated from the audio.js manifest (params metadata is the source of truth).
// Regenerate: node tools/dts.js in @audio/compile. Do not edit by hand.

/** Automatable number — scalar, `t => value` fn, or breakpoint curve {t, v} */
type Auto = number | ((t: number) => number) | { t: number[], v: number[] }
/** Per-block param values as delivered by hosts (numbers arrive as 1-length Float32Array) */
type Live = Record<string, Float32Array | string | boolean>
type Ctx = { sampleRate: number, maxBlockSize: number, maxChannels: number, currentTime: number, duration?: number, events?: readonly any[], emit?: (name: string, ...args: any[]) => void, [k: string]: unknown }
type Process = (inputs: Float32Array[][], outputs: Float32Array[][], params: Live) => void

/** Chainable-host options for 'ducker' */
export interface DuckerOptions {
  /** -60..0 dB (default -30) */
  "threshold"?: Auto
  /** 1..20 (default 4) */
  "ratio"?: Auto
  /** 0..24 dB (default 6) */
  "knee"?: Auto
  /** -90..0 dB (default -24) */
  "range"?: Auto
  /** 0.1..200 ms (default 20) */
  "attack"?: Auto
  /** 1..2000 ms (default 300) */
  "release"?: Auto
  at?: number | string
  duration?: number | string
}

export declare const ducker: {
  (ctx: Ctx): Process
  channels: {"inputs":[2,2],"outputs":[2]}
  tail: 0
  params: {
    /** -60..0 dB (default -30) */
    "threshold": { type: "number", default: -30 }
    /** 1..20 (default 4) */
    "ratio": { type: "number", default: 4 }
    /** 0..24 dB (default 6) */
    "knee": { type: "number", default: 6 }
    /** -90..0 dB (default -24) */
    "range": { type: "number", default: -24 }
    /** 0.1..200 ms (default 20) [restart] */
    "attack": { type: "number", default: 20 }
    /** 1..2000 ms (default 300) [restart] */
    "release": { type: "number", default: 300 }
  }
}
