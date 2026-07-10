// Generated from the audio.js manifest (params metadata is the source of truth).
// Regenerate: node tools/dts.js in @audio/compile. Do not edit by hand.

/** Automatable number — scalar, `t => value` fn, or breakpoint curve {t, v} */
type Auto = number | ((t: number) => number) | { t: number[], v: number[] }
/** Per-block param values as delivered by hosts (numbers arrive as 1-length Float32Array) */
type Live = Record<string, Float32Array | string | boolean>
type Ctx = { sampleRate: number, maxBlockSize: number, maxChannels: number, currentTime: number, duration?: number, events?: readonly any[], emit?: (name: string, ...args: any[]) => void, [k: string]: unknown }
type Process = (inputs: Float32Array[][], outputs: Float32Array[][], params: Live) => void

/** Chainable-host options for 'compand' */
export interface CompandOptions {
  /** -90..0 dB (default -90) */
  "out0"?: Auto
  /** -90..0 dB (default -60) */
  "out1"?: Auto
  /** -90..0 dB (default -20) */
  "out2"?: Auto
  /** -90..0 dB (default -8) */
  "out3"?: Auto
  /** 0.1..200 ms (default 5) */
  "attack"?: Auto
  /** 1..2000 ms (default 200) */
  "release"?: Auto
  at?: number | string
  duration?: number | string
}

export declare const compand: {
  (ctx: Ctx): Process
  channels: "any"
  tail: 0
  params: {
    /** -90..0 dB (default -90) [restart] */
    "out0": { type: "number", default: -90 }
    /** -90..0 dB (default -60) [restart] */
    "out1": { type: "number", default: -60 }
    /** -90..0 dB (default -20) [restart] */
    "out2": { type: "number", default: -20 }
    /** -90..0 dB (default -8) [restart] */
    "out3": { type: "number", default: -8 }
    /** 0.1..200 ms (default 5) [restart] */
    "attack": { type: "number", default: 5 }
    /** 1..2000 ms (default 200) [restart] */
    "release": { type: "number", default: 200 }
  }
}
