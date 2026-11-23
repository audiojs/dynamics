// Generated from the audio.js manifest (params metadata is the source of truth).
// Regenerate: node tools/dts.js in @audio/plugin. Do not edit by hand.

/** Automatable number — scalar, `t => value` fn, or breakpoint curve {t, v} */
type Auto = number | ((t: number) => number) | { t: number[], v: number[] }
/** Per-block param values as delivered by hosts (numbers arrive as 1-length Float32Array) */
type Live = Record<string, Float32Array | string | boolean>
type Transport = Readonly<{ playing: boolean, bpm: number, beat: number, barStart: number, timeSig: [number, number] }>
/** What a host hands a processor it builds: the contract's Context (CONTRACT.d.ts, 1.0) */
type Ctx = { readonly sampleRate: number, readonly maxBlockSize: number, readonly maxChannels: number, readonly layouts?: { readonly inputs: readonly (string | undefined)[], readonly outputs: readonly (string | undefined)[] }, readonly params: Live, readonly buffers: Readonly<Record<string, Float32Array[] | undefined>>, readonly events?: readonly { time: number, kind: 'on' | 'off', midi: number, velocity: number, id: number }[], emit(name: string, value: number): void, readonly transport: Transport }
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
  latency: (at: { sampleRate: number, params: Live, buffers?: {}, transport: Transport }) => number
  tail: (at: { sampleRate: number, params: Live, buffers?: {}, transport: Transport }) => number
  params: {
    /** default "split" */
    "mode": { type: "enum", values: ["split","band","broadband"], default: "split" }
    /** 1000..16000 Hz (default 3500) */
    "split": { type: "number", min: 1000, max: 16000, default: 3500, unit: "Hz" }
    /** 2000..16000 Hz (default 6500) */
    "fc": { type: "number", min: 2000, max: 16000, default: 6500, unit: "Hz", alias: "freq" }
    /** 0.3..10 (default 1.4) */
    "Q": { type: "number", min: 0.3, max: 10, default: 1.4, alias: "q" }
    /** -12..24 dB (default 0) */
    "threshold": { type: "number", min: -12, max: 24, default: 0, unit: "dB" }
    /** 1..20 (default 4) */
    "ratio": { type: "number", min: 1, max: 20, default: 4 }
    /** -24..0 dB (default -8) */
    "range": { type: "number", min: -24, max: 0, default: -8, unit: "dB" }
    /** 0..24 dB (default 6) */
    "knee": { type: "number", min: 0, max: 24, default: 6, unit: "dB" }
    /** 0.1..100 ms (default 1) */
    "attack": { type: "number", min: 0.1, max: 100, default: 1, unit: "ms" }
    /** 1..1000 ms (default 15) */
    "release": { type: "number", min: 1, max: 1000, default: 15, unit: "ms" }
    /** 0..20 ms (default 5) [restart] */
    "lookahead": { type: "number", min: 0, max: 20, default: 5, unit: "ms", restart: true }
  }
}
