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
  tail: (at: { sampleRate: number, params: Live, buffers?: {}, transport: Transport }) => number
  params: {
    /** 40..1000 Hz (default 200) */
    "low": { type: "number", min: 40, max: 1000, default: 200, unit: "Hz", curve: "log", smoothing: 0.02 }
    /** 1000..12000 Hz (default 2000) */
    "high": { type: "number", min: 1000, max: 12000, default: 2000, unit: "Hz", curve: "log", smoothing: 0.02 }
    /** -60..0 dB (default -24) */
    "threshold": { type: "number", min: -60, max: 0, default: -24, unit: "dB", smoothing: 0.02 }
    /** 1..20 (default 3) */
    "ratio": { type: "number", min: 1, max: 20, default: 3, smoothing: 0.02 }
    /** -80..0 dB (default -40) */
    "upThreshold": { type: "number", min: -80, max: 0, default: -40, unit: "dB", smoothing: 0.02 }
    /** 1..20 (default 1) */
    "upRatio": { type: "number", min: 1, max: 20, default: 1, smoothing: 0.02 }
    /** 0..2 (default 1) */
    "depth": { type: "number", min: 0, max: 2, default: 1, smoothing: 0.02 }
    /** 0.1..100 ms (default 5) */
    "attack": { type: "number", min: 0.1, max: 100, default: 5, unit: "ms" }
    /** 20..2000 ms (default 150) */
    "release": { type: "number", min: 20, max: 2000, default: 150, unit: "ms" }
    /** -12..24 dB (default 0) */
    "makeup": { type: "number", min: -12, max: 24, default: 0, unit: "dB", smoothing: 0.02 }
  }
}
