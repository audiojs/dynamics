// Keep the umbrella API identical to its leaf exports.
export { default as compressor, compressorGain, upwardGain } from '@audio/dynamics-compressor'
export { default as limiter } from '@audio/dynamics-limiter'
export { default as gate } from '@audio/dynamics-gate'
export { default as expander, upwardExpanderGain } from '@audio/dynamics-expander'
export { default as unlimit, unlimitGain } from '@audio/dynamics-unlimit'
export { default as deesser } from '@audio/dynamics-deesser'
export { default as ducker } from '@audio/dynamics-ducker'
export { default as softclip } from '@audio/dynamics-softclip'
export { default as compand } from '@audio/dynamics-compand'
export { default as transientShaper } from '@audio/dynamics-transient-shaper'
export { default as multiband } from '@audio/dynamics-multiband'
export { envelope } from '@audio/dynamics-envelope'
export { default as opto } from '@audio/dynamics-opto'
export { default as fet } from '@audio/dynamics-fet'
export { default as vca } from '@audio/dynamics-vca'
export { default as varimu } from '@audio/dynamics-varimu'
export { default as leveler } from '@audio/dynamics-leveler'

export type { CompandOptions } from '@audio/dynamics-compand'
export type { CompressorOptions } from '@audio/dynamics-compressor'
export type { DeesserOptions } from '@audio/dynamics-deesser'
export type { DuckerOptions } from '@audio/dynamics-ducker'
export type { EnvelopeOptions } from '@audio/dynamics-envelope'
export type { ExpanderOptions } from '@audio/dynamics-expander'
export type { FetOptions } from '@audio/dynamics-fet'
export type { GateOptions } from '@audio/dynamics-gate'
export type { LevelerOptions } from '@audio/dynamics-leveler'
export type { LimiterOptions } from '@audio/dynamics-limiter'
export type { MultibandBandOptions, MultibandOptions } from '@audio/dynamics-multiband'
export type { OptoOptions } from '@audio/dynamics-opto'
export type { SoftclipOptions } from '@audio/dynamics-softclip'
export type { TransientShaperOptions } from '@audio/dynamics-transient-shaper'
export type { UnlimitOptions } from '@audio/dynamics-unlimit'
export type { VarimuOptions } from '@audio/dynamics-varimu'
export type { VcaOptions } from '@audio/dynamics-vca'

// Retain the existing umbrella option names for consumers.
export type { EnvelopeOptions as EnvelopeOpts } from '@audio/dynamics-envelope'
export type { CompressorOptions as CompressorOpts } from '@audio/dynamics-compressor'
export type { LimiterOptions as LimiterOpts } from '@audio/dynamics-limiter'
export type { ExpanderOptions as ExpanderOpts } from '@audio/dynamics-expander'
export type { UnlimitOptions as UnlimitOpts } from '@audio/dynamics-unlimit'
export type { DuckerOptions as DuckerOpts } from '@audio/dynamics-ducker'
export type { SoftclipOptions as SoftclipOpts } from '@audio/dynamics-softclip'
export type { CompandOptions as CompandOpts } from '@audio/dynamics-compand'
import type { GateOptions } from '@audio/dynamics-gate'
export interface GateOpts extends GateOptions {
  /** @deprecated Ignored by this processor; the RMS window is fixed at 256 samples. */
  rmsWindow?: number
}
import type { DeesserOptions } from '@audio/dynamics-deesser'
export interface DeesserOpts extends DeesserOptions {
  /** @deprecated Ignored by this processor; the RMS window is fixed at 256 samples. */
  rmsWindow?: number
}
