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

/** Chainable-host options for 'expander' */
export interface ExpanderOptions {
  /** default "downward" */
  "mode"?: "downward" | "upward"
  /** -80..0 dB (default -30) */
  "threshold"?: Auto
  /** 1..20 (default 2) */
  "ratio"?: Auto
  /** 0..24 dB (default 6) */
  "knee"?: Auto
  /** 0..90 dB (default 40) */
  "range"?: Auto
  /** 0.1..100 ms (default 5) */
  "attack"?: Auto
  /** 1..1000 ms (default 50) */
  "release"?: Auto
  /** 0..1 (default 0) */
  "link"?: Auto
  at?: number | string
  duration?: number | string
}

export declare const expander: {
  (ctx: Ctx): Process
  channels: {"inputs":[{"channels":"any"},{"channels":"any","name":"key"}],"outputs":"any"}
  tail: 0
  params: {
    /** default "downward" */
    "mode": { type: "enum", values: ["downward","upward"], default: "downward" }
    /** -80..0 dB (default -30) */
    "threshold": { type: "number", min: -80, max: 0, default: -30, unit: "dB", smoothing: 0.02 }
    /** 1..20 (default 2) */
    "ratio": { type: "number", min: 1, max: 20, default: 2, smoothing: 0.02 }
    /** 0..24 dB (default 6) */
    "knee": { type: "number", min: 0, max: 24, default: 6, unit: "dB", smoothing: 0.02 }
    /** 0..90 dB (default 40) */
    "range": { type: "number", min: 0, max: 90, default: 40, unit: "dB", smoothing: 0.02 }
    /** 0.1..100 ms (default 5) */
    "attack": { type: "number", min: 0.1, max: 100, default: 5, unit: "ms" }
    /** 1..1000 ms (default 50) */
    "release": { type: "number", min: 1, max: 1000, default: 50, unit: "ms" }
    /** 0..1 (default 0) */
    "link": { type: "number", min: 0, max: 1, default: 0, smoothing: 0.02 }
  }
}
