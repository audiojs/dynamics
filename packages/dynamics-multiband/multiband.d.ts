/** Per-band settings, read as `@audio/dynamics-compressor` 0.2's batch call reads them (upward compression and the OTT "Depth" macro included; `detector: 'rms'` and `rmsWindow` too). A band's own `sampleRate` or `fs` is read over the multiband-level `fs`. */
export interface MultibandBandOptions {
  /** dB, downward-compression threshold, default -20 */
  threshold?: number
  /** downward ratio, default 4 */
  ratio?: number
  /** dB, soft-knee width, default 6 */
  knee?: number
  /** ms, default 5 */
  attack?: number
  /** ms, default 100 */
  release?: number
  /** dB, output makeup gain, default 0 */
  makeup?: number
  /** scales the summed up+down gain before makeup (OTT "Depth" macro; 0 = identity), default 1 */
  depth?: number
  /** dB, upward-compression threshold; null disables upward compression, default null */
  upThreshold?: number | null
  /** upward ratio, default 2 */
  upRatio?: number
  /** dB, upward soft-knee width, default 6 */
  upKnee?: number
  /** dB, max upward lift, default 12 */
  upRange?: number
}

/** Multiband compressor — Linkwitz-Riley crossover split, an independent compressor per band, flat sum by construction: each band carries the allpasses of the crossovers over it, so with nothing compressed the bands add to the crossovers' allpass (the input's magnitude, its phase turned). */
export interface MultibandOptions {
  /** Hz, N-1 crossover points for N bands, default [200, 2000] */
  freqs?: number[]
  /** per-band settings, or one object shared by all bands; `null`/omitted entries pass that band through uncompressed */
  bands?: MultibandBandOptions | (MultibandBandOptions | null)[]
  /** Linkwitz-Riley crossover order, default 4 */
  order?: 2 | 4 | 8
  /** Hz, default 44100 (this atom reads `fs`, not `sampleRate`) */
  fs?: number
}

/** Mutates `data` in place (sums the compressed bands back over it) and returns it. */
export default function multiband(data: Float32Array, options?: MultibandOptions): Float32Array

/** The writer form: `write(chunk)` returns the chunk's bands summed (a new array), the crossovers' and followers' state carried from chunk to chunk; `flush()` returns nothing more (there is no delay). Fed a signal in chunks, it gives what `multiband` gives it whole. */
export function multibandStream(options?: MultibandOptions): { write(chunk: Float32Array): Float32Array, flush(): Float32Array }

/** Settings each band takes in multibandBlock's `set`, from band·BAND: 1 to compress (0: pass), threshold, ratio, knee, makeup, depth; 1 for the upward curve (0: off), upThreshold, upRatio, upKnee, upRange; the follower's attack and release coefficients (α = e^(−1/(τ·fs))); 1 for RMS (0: peak). */
export const BAND: 14

/** One block of one channel into `out` (may be `x`, returned), allocating nothing; the manifest's path. `co`: the sections' coefficients, b0 b1 b2 a1 a2 each; `at`: band b's sections are at[b] to at[b + 1]; `st`: the sections' state, two each (transposed direct form II). `set`: the bands' settings (BAND each); `bandState`: their followers, the level and the RMS window's sum and position (3 each); `rings`: each band's RMS window (empty for peak). `tmp` and `acc`: scratch as long as the block. `lanes`: one setting for every compressing band, sample by sample, as a host's ramp moves it (the manifest's): threshold, ratio, makeup, depth, upThreshold and upRatio from 0, `stride` … 5·`stride`; empty or absent, each band's own in `set`. */
export function multibandBlock(x: Float32Array, out: Float32Array, co: Float64Array, at: Int32Array, st: Float64Array, set: Float64Array, bandState: Float64Array, rings: Float32Array[], tmp: Float32Array, acc: Float64Array, lanes?: Float64Array, stride?: number): Float32Array

/** The manifest's three-band LR4 network into `co` (Float64Array(55)), allocating nothing; `f`: the low and high crossovers (Hz) and the sample rate. Sections 0-2 the low band, 3-6 the mid, 7-10 the high (`at` = [0, 3, 7, 11]); the numbers `multiband` takes from @audio/eq-crossover at order 4. */
export function split3(co: Float64Array, f: Float64Array): Float64Array

/** Seconds the manifest's output takes to fall 60 dB under the input's level once the input stops, its low crossover at `low` Hz: from that crossover's poles (a double pair, the slowest). `lift`: dB the band compressors may raise the ring by (makeup, the upward lift), default 0. */
export function tail(low: number, sampleRate: number, lift?: number): number
