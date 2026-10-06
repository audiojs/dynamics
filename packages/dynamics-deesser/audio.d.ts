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
  /** default "split" */
  "mode"?: "split" | "band" | "broadband"
  /** 1000..16000 Hz (default 3500) */
  "split"?: Auto
  /** 2000..16000 Hz (default 6500) */
  "fc"?: Auto
  /** @deprecated former name of "fc" */
  "freq"?: Auto
  /** 0.3..10 (default 1.4) */
  "Q"?: Auto
  /** @deprecated former name of "Q" */
  "q"?: Auto
  /** -12..24 dB (default 0) */
  "threshold"?: Auto
  /** 1..20 (default 4) */
  "ratio"?: Auto
  /** -24..0 dB (default -8) */
  "range"?: Auto
  /** 0..24 dB (default 6) */
  "knee"?: Auto
  /** 0.1..100 ms (default 1) */
  "attack"?: Auto
  /** 1..1000 ms (default 15) */
  "release"?: Auto
  /** 0..20 ms (default 5) */
  "lookahead"?: Auto
  at?: number | string
  duration?: number | string
}

export declare const deesser: {
  (ctx: Ctx): Process
  channels: "any"
  latency: (ctx: { sampleRate: number, params: Live }) => number
  params: {
    /** default "split" [restart] */
    "mode": { type: "enum", values: ["split","band","broadband"], default: "split" }
    /** 1000..16000 Hz (default 3500) [restart] */
    "split": { type: "number", default: 3500 }
    /** 2000..16000 Hz (default 6500) [restart] */
    "fc": { type: "number", default: 6500, alias: "freq" }
    /** 0.3..10 (default 1.4) [restart] */
    "Q": { type: "number", default: 1.4, alias: "q" }
    /** -12..24 dB (default 0) [restart] */
    "threshold": { type: "number", default: 0 }
    /** 1..20 (default 4) [restart] */
    "ratio": { type: "number", default: 4 }
    /** -24..0 dB (default -8) [restart] */
    "range": { type: "number", default: -8 }
    /** 0..24 dB (default 6) [restart] */
    "knee": { type: "number", default: 6 }
    /** 0.1..100 ms (default 1) [restart] */
    "attack": { type: "number", default: 1 }
    /** 1..1000 ms (default 15) [restart] */
    "release": { type: "number", default: 15 }
    /** 0..20 ms (default 5) [restart] */
    "lookahead": { type: "number", default: 5 }
  }
}
