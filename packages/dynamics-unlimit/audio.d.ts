// Generated from the audio.js manifest (params metadata is the source of truth).
// Regenerate: node tools/dts.js in @audio/compile. Do not edit by hand.

/** Automatable number — scalar, `t => value` fn, or breakpoint curve {t, v} */
type Auto = number | ((t: number) => number) | { t: number[], v: number[] }
/** Per-block param values as delivered by hosts (numbers arrive as 1-length Float32Array) */
type Live = Record<string, Float32Array | string | boolean>
type Ctx = { sampleRate: number, maxBlockSize: number, maxChannels: number, currentTime: number, duration?: number, events?: readonly any[], emit?: (name: string, ...args: any[]) => void, [k: string]: unknown }
type Process = (inputs: Float32Array[][], outputs: Float32Array[][], params: Live) => void

/** Chainable-host options for 'unlimit' */
export interface UnlimitOptions {
  /** 0..18 dB (default 6) */
  "amount"?: Auto
  /** 0..10 (default 1) */
  "drive"?: Auto
  /** default true */
  "adaptive"?: boolean
  /** 3..25 dB (default 10) */
  "crestTarget"?: Auto
  /** -60..24 dB (default 24) */
  "ceiling"?: Auto
  /** 0.1..10 ms (default 0.5) */
  "fastAttack"?: Auto
  /** 1..100 ms (default 20) */
  "fastRelease"?: Auto
  /** 1..200 ms (default 20) */
  "slowAttack"?: Auto
  /** 10..1000 ms (default 200) */
  "slowRelease"?: Auto
  at?: number | string
  duration?: number | string
}

export declare const unlimit: {
  (ctx: Ctx): Process
  channels: "any"
  tail: 0
  params: {
    /** 0..18 dB (default 6) */
    "amount": { type: "number", default: 6 }
    /** 0..10 (default 1) */
    "drive": { type: "number", default: 1 }
    /** default true */
    "adaptive": { type: "bool", default: true }
    /** 3..25 dB (default 10) */
    "crestTarget": { type: "number", default: 10 }
    /** -60..24 dB (default 24) */
    "ceiling": { type: "number", default: 24 }
    /** 0.1..10 ms (default 0.5) [restart] */
    "fastAttack": { type: "number", default: 0.5 }
    /** 1..100 ms (default 20) [restart] */
    "fastRelease": { type: "number", default: 20 }
    /** 1..200 ms (default 20) [restart] */
    "slowAttack": { type: "number", default: 20 }
    /** 10..1000 ms (default 200) [restart] */
    "slowRelease": { type: "number", default: 200 }
  }
}
