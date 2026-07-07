// @audio/dynamics — dynamics processing umbrella re-exporting every @audio/dynamics-* atom.
// For smaller bundles, depend directly on the individual atom.

export { default as compressor, compressorGain } from '@audio/dynamics-compressor'
export { default as limiter } from '@audio/dynamics-limiter'
export { default as gate } from '@audio/dynamics-gate'
export { default as expander } from '@audio/dynamics-expander'
export { default as deesser } from '@audio/dynamics-deesser'
export { default as ducker } from '@audio/dynamics-ducker'
export { default as softclip } from '@audio/dynamics-softclip'
export { default as compand } from '@audio/dynamics-compand'
export { default as transientShaper } from '@audio/dynamics-transient-shaper'
export { default as multiband } from '@audio/dynamics-multiband'
export { envelope } from '@audio/dynamics-envelope'
