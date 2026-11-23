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

/** Chainable-host options for 'limiter' */
export interface LimiterOptions {
  /** -30..0 dB (default -0.3) */
  "ceiling"?: Auto
  /** 0.1..20 ms (default 5) */
  "lookahead"?: Auto
  /** 1..1000 ms (default 50) */
  "release"?: Auto
  /** default false */
  "truePeak"?: boolean
  /** 0..1 (default 0) */
  "link"?: Auto
  at?: number | string
  duration?: number | string
}

export declare const limiter: {
  (ctx: Ctx): Process
  channels: "any"
  latency: (at: { sampleRate: number, params: Live, buffers?: {}, transport: Transport }) => number
  params: {
    /** -30..0 dB (default -0.3) */
    "ceiling": { type: "number", min: -30, max: 0, default: -0.3, unit: "dB" }
    /** 0.1..20 ms (default 5) [restart] */
    "lookahead": { type: "number", min: 0.1, max: 20, default: 5, unit: "ms", restart: true }
    /** 1..1000 ms (default 50) */
    "release": { type: "number", min: 1, max: 1000, default: 50, unit: "ms" }
    /** default false [restart] */
    "truePeak": { type: "bool", default: false, restart: true }
    /** 0..1 (default 0) */
    "link": { type: "number", min: 0, max: 1, default: 0, smoothing: 0.01 }
  }
}
