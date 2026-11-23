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
    "amount": { type: "number", min: 0, max: 18, default: 6, unit: "dB" }
    /** 0..10 (default 1) */
    "drive": { type: "number", min: 0, max: 10, default: 1 }
    /** default true */
    "adaptive": { type: "bool", default: true }
    /** 3..25 dB (default 10) */
    "crestTarget": { type: "number", min: 3, max: 25, default: 10, unit: "dB" }
    /** -60..24 dB (default 24) */
    "ceiling": { type: "number", min: -60, max: 24, default: 24, unit: "dB", smoothing: 0.02 }
    /** 0.1..10 ms (default 0.5) */
    "fastAttack": { type: "number", min: 0.1, max: 10, default: 0.5, unit: "ms" }
    /** 1..100 ms (default 20) */
    "fastRelease": { type: "number", min: 1, max: 100, default: 20, unit: "ms" }
    /** 1..200 ms (default 20) */
    "slowAttack": { type: "number", min: 1, max: 200, default: 20, unit: "ms" }
    /** 10..1000 ms (default 200) */
    "slowRelease": { type: "number", min: 10, max: 1000, default: 200, unit: "ms" }
  }
}
