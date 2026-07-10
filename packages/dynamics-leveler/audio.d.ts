// Generated from the audio.js manifest (params metadata is the source of truth).
// Regenerate: node tools/dts.js in @audio/compile. Do not edit by hand.

/** Automatable number — scalar, `t => value` fn, or breakpoint curve {t, v} */
type Auto = number | ((t: number) => number) | { t: number[], v: number[] }
/** Per-block param values as delivered by hosts (numbers arrive as 1-length Float32Array) */
type Live = Record<string, Float32Array | string | boolean>
type Ctx = { sampleRate: number, maxBlockSize: number, maxChannels: number, currentTime: number, duration?: number, events?: readonly any[], emit?: (name: string, ...args: any[]) => void, [k: string]: unknown }
type Process = (inputs: Float32Array[][], outputs: Float32Array[][], params: Live) => void

/** Chainable-host options for 'leveler' */
export interface LevelerOptions {
  /** -40..0 dB (default -20) */
  "target"?: Auto
  /** 0.05..5 s (default 0.5) */
  "frame"?: Auto
  /** 0..30 dB (default 12) */
  "maxGain"?: Auto
  /** 0..30 (default 5) */
  "smooth"?: Auto
  at?: number | string
  duration?: number | string
}

export declare const leveler: {
  (ctx: Ctx): Process
  channels: "any"
  streaming: false
  tail: 0
  params: {
    /** -40..0 dB (default -20) */
    "target": { type: "number", default: -20 }
    /** 0.05..5 s (default 0.5) */
    "frame": { type: "number", default: 0.5 }
    /** 0..30 dB (default 12) */
    "maxGain": { type: "number", default: 12 }
    /** 0..30 (default 5) */
    "smooth": { type: "number", default: 5 }
  }
}
