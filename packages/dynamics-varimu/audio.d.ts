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

/** Chainable-host options for 'varimu' */
export interface VarimuOptions {
  /** -60..0 dB (default -22) */
  "threshold"?: Auto
  /** 6..30 dB (default 15) */
  "knee"?: Auto
  /** 5..200 ms (default 25) */
  "attack"?: Auto
  /** 50..2000 ms (default 400) */
  "release"?: Auto
  /** -12..24 dB (default 0) */
  "makeup"?: Auto
  at?: number | string
  duration?: number | string
}

export declare const varimu: {
  (ctx: Ctx): Process
  channels: "any"
  tail: 0
  params: {
    /** -60..0 dB (default -22) */
    "threshold": { type: "number", min: -60, max: 0, default: -22, unit: "dB" }
    /** 6..30 dB (default 15) */
    "knee": { type: "number", min: 6, max: 30, default: 15, unit: "dB" }
    /** 5..200 ms (default 25) */
    "attack": { type: "number", min: 5, max: 200, default: 25, unit: "ms" }
    /** 50..2000 ms (default 400) */
    "release": { type: "number", min: 50, max: 2000, default: 400, unit: "ms" }
    /** -12..24 dB (default 0) */
    "makeup": { type: "number", min: -12, max: 24, default: 0, unit: "dB", smoothing: 0.02 }
  }
}
