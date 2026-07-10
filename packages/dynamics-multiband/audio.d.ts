// Generated from the audio.js manifest (params metadata is the source of truth).
// Regenerate: node tools/dts.js in @audio/compile. Do not edit by hand.

/** Automatable number — scalar, `t => value` fn, or breakpoint curve {t, v} */
type Auto = number | ((t: number) => number) | { t: number[], v: number[] }
/** Per-block param values as delivered by hosts (numbers arrive as 1-length Float32Array) */
type Live = Record<string, Float32Array | string | boolean>
type Ctx = { sampleRate: number, maxBlockSize: number, maxChannels: number, currentTime: number, duration?: number, events?: readonly any[], emit?: (name: string, ...args: any[]) => void, [k: string]: unknown }
type Process = (inputs: Float32Array[][], outputs: Float32Array[][], params: Live) => void

/** Chainable-host options for 'multiband' */
export interface MultibandOptions {
  /** 40..1000 Hz (default 200) */
  "low"?: Auto
  /** 1000..12000 Hz (default 2000) */
  "high"?: Auto
  /** -60..0 dB (default -24) */
  "threshold"?: Auto
  /** 1..20 (default 3) */
  "ratio"?: Auto
  /** -80..0 dB (default -40) */
  "upThreshold"?: Auto
  /** 1..20 (default 1) */
  "upRatio"?: Auto
  /** 0..2 (default 1) */
  "depth"?: Auto
  /** 0.1..100 ms (default 5) */
  "attack"?: Auto
  /** 20..2000 ms (default 150) */
  "release"?: Auto
  /** -12..24 dB (default 0) */
  "makeup"?: Auto
  at?: number | string
  duration?: number | string
}

export declare const multiband: {
  (ctx: Ctx): Process
  channels: "any"
  streaming: false
  tail: 0.3
  params: {
    /** 40..1000 Hz (default 200) */
    "low": { type: "number", default: 200 }
    /** 1000..12000 Hz (default 2000) */
    "high": { type: "number", default: 2000 }
    /** -60..0 dB (default -24) */
    "threshold": { type: "number", default: -24 }
    /** 1..20 (default 3) */
    "ratio": { type: "number", default: 3 }
    /** -80..0 dB (default -40) */
    "upThreshold": { type: "number", default: -40 }
    /** 1..20 (default 1) */
    "upRatio": { type: "number", default: 1 }
    /** 0..2 (default 1) */
    "depth": { type: "number", default: 1 }
    /** 0.1..100 ms (default 5) */
    "attack": { type: "number", default: 5 }
    /** 20..2000 ms (default 150) */
    "release": { type: "number", default: 150 }
    /** -12..24 dB (default 0) */
    "makeup": { type: "number", default: 0 }
  }
}
