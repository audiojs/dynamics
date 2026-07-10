// Generated from the audio.js manifest (params metadata is the source of truth).
// Regenerate: node tools/dts.js in @audio/compile. Do not edit by hand.

/** Automatable number — scalar, `t => value` fn, or breakpoint curve {t, v} */
type Auto = number | ((t: number) => number) | { t: number[], v: number[] }
/** Per-block param values as delivered by hosts (numbers arrive as 1-length Float32Array) */
type Live = Record<string, Float32Array | string | boolean>
type Ctx = { sampleRate: number, maxBlockSize: number, maxChannels: number, currentTime: number, duration?: number, events?: readonly any[], emit?: (name: string, ...args: any[]) => void, [k: string]: unknown }
type Process = (inputs: Float32Array[][], outputs: Float32Array[][], params: Live) => void

/** Chainable-host options for 'varimu' */
export interface VarimuOptions {
  /** -60..0 dB (default -22) */
  "threshold"?: Auto
  /** 6..30 dB (default 15) */
  "knee"?: Auto
  /** 5..200 ms (default 25) */
  "attack"?: Auto
  /** 50..2000 ms (default 400) */
  "release"?: Auto
  /** -12..24 dB (default 0) */
  "makeup"?: Auto
  at?: number | string
  duration?: number | string
}

export declare const varimu: {
  (ctx: Ctx): Process
  channels: "any"
  tail: 0.5
  params: {
    /** -60..0 dB (default -22) [restart] */
    "threshold": { type: "number", default: -22 }
    /** 6..30 dB (default 15) [restart] */
    "knee": { type: "number", default: 15 }
    /** 5..200 ms (default 25) [restart] */
    "attack": { type: "number", default: 25 }
    /** 50..2000 ms (default 400) [restart] */
    "release": { type: "number", default: 400 }
    /** -12..24 dB (default 0) [restart] */
    "makeup": { type: "number", default: 0 }
  }
}
