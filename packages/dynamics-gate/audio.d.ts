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

/** Chainable-host options for 'gate' */
export interface GateOptions {
  /** -80..0 dB (default -40) */
  "threshold"?: Auto
  /** -90..0 dB (default -46) */
  "closeThreshold"?: Auto
  /** -90..0 dB (default -60) */
  "range"?: Auto
  /** 0..500 ms (default 10) */
  "hold"?: Auto
  /** 0.01..100 ms (default 0.1) */
  "attack"?: Auto
  /** 1..1000 ms (default 100) */
  "release"?: Auto
  /** 0..50 ms (default 0) */
  "lookahead"?: Auto
  /** 0..1 (default 0) */
  "link"?: Auto
  at?: number | string
  duration?: number | string
}

export declare const gate: {
  (ctx: Ctx): Process
  channels: {"inputs":[{"channels":"any"},{"channels":"any","name":"key"}],"outputs":"any"}
  latency: (at: { sampleRate: number, params: Live, buffers?: {}, transport: Transport }) => number
  tail: 0
  params: {
    /** -80..0 dB (default -40) */
    "threshold": { type: "number", min: -80, max: 0, default: -40, unit: "dB" }
    /** -90..0 dB (default -46) */
    "closeThreshold": { type: "number", min: -90, max: 0, default: -46, unit: "dB" }
    /** -90..0 dB (default -60) */
    "range": { type: "number", min: -90, max: 0, default: -60, unit: "dB", smoothing: 0.02 }
    /** 0..500 ms (default 10) */
    "hold": { type: "number", min: 0, max: 500, default: 10, unit: "ms" }
    /** 0.01..100 ms (default 0.1) */
    "attack": { type: "number", min: 0.01, max: 100, default: 0.1, unit: "ms" }
    /** 1..1000 ms (default 100) */
    "release": { type: "number", min: 1, max: 1000, default: 100, unit: "ms" }
    /** 0..50 ms (default 0) [restart] */
    "lookahead": { type: "number", min: 0, max: 50, default: 0, unit: "ms", restart: true }
    /** 0..1 (default 0) */
    "link": { type: "number", min: 0, max: 1, default: 0, smoothing: 0.01 }
  }
}
