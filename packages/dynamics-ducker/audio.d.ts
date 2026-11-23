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

/** Chainable-host options for 'ducker' */
export interface DuckerOptions {
  /** -60..0 dB (default -30) */
  "threshold"?: Auto
  /** 1..20 (default 4) */
  "ratio"?: Auto
  /** 0..24 dB (default 6) */
  "knee"?: Auto
  /** -90..0 dB (default -24) */
  "range"?: Auto
  /** 0.1..200 ms (default 20) */
  "attack"?: Auto
  /** 1..2000 ms (default 300) */
  "release"?: Auto
  at?: number | string
  duration?: number | string
}

export declare const ducker: {
  (ctx: Ctx): Process
  channels: {"inputs":[{"channels":"any"},{"channels":"any","name":"key"}],"outputs":"any"}
  tail: 0
  params: {
    /** -60..0 dB (default -30) */
    "threshold": { type: "number", min: -60, max: 0, default: -30, unit: "dB", smoothing: 0.02 }
    /** 1..20 (default 4) */
    "ratio": { type: "number", min: 1, max: 20, default: 4, smoothing: 0.02 }
    /** 0..24 dB (default 6) */
    "knee": { type: "number", min: 0, max: 24, default: 6, unit: "dB", smoothing: 0.02 }
    /** -90..0 dB (default -24) */
    "range": { type: "number", min: -90, max: 0, default: -24, unit: "dB", smoothing: 0.02 }
    /** 0.1..200 ms (default 20) */
    "attack": { type: "number", min: 0.1, max: 200, default: 20, unit: "ms" }
    /** 1..2000 ms (default 300) */
    "release": { type: "number", min: 1, max: 2000, default: 300, unit: "ms" }
  }
}
