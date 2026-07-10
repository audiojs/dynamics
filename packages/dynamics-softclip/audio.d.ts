// Generated from the audio.js manifest (params metadata is the source of truth).
// Regenerate: node tools/dts.js in @audio/compile. Do not edit by hand.

/** Automatable number — scalar, `t => value` fn, or breakpoint curve {t, v} */
type Auto = number | ((t: number) => number) | { t: number[], v: number[] }
/** Per-block param values as delivered by hosts (numbers arrive as 1-length Float32Array) */
type Live = Record<string, Float32Array | string | boolean>
type Ctx = { sampleRate: number, maxBlockSize: number, maxChannels: number, currentTime: number, duration?: number, events?: readonly any[], emit?: (name: string, ...args: any[]) => void, [k: string]: unknown }
type Process = (inputs: Float32Array[][], outputs: Float32Array[][], params: Live) => void

/** Chainable-host options for 'softclip' */
export interface SoftclipOptions {
  /** default "tanh" */
  "curve"?: "tanh" | "atan" | "cubic" | "sin" | "hard"
  /** 0.1..20 (default 1) */
  "drive"?: Auto
  /** 0.05..1 (default 1) */
  "ceiling"?: Auto
  at?: number | string
  duration?: number | string
}

export declare const softclip: {
  (ctx: Ctx): Process
  channels: "any"
  params: {
    /** default "tanh" */
    "curve": { type: "enum", values: ["tanh","atan","cubic","sin","hard"], default: "tanh" }
    /** 0.1..20 (default 1) */
    "drive": { type: "number", default: 1 }
    /** 0.05..1 (default 1) */
    "ceiling": { type: "number", default: 1 }
  }
}
