/** Per-band settings — spread directly into `@audio/dynamics-compressor`'s batch call (upward compression and the OTT "Depth" macro included). `sampleRate`/`fs` are forced from the multiband-level `fs` option and cannot be overridden per band. */
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

/** Multiband compressor — Linkwitz-Riley crossover split, an independent compressor per band, flat sum by construction. */
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

/** Mutates `data` in place (sums the compressed bands back over it) and returns it. Batch only — no streaming form. */
export default function multiband(data: Float32Array, options?: MultibandOptions): Float32Array
