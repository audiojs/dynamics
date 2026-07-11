# @audio/dynamics-multiband [![npm](https://img.shields.io/npm/v/@audio/dynamics-multiband)](https://www.npmjs.com/package/@audio/dynamics-multiband) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Multiband compressor — Linkwitz-Riley split + per-band soft-knee compression, flat sum (SoX mcompand class)

```
npm install @audio/dynamics-multiband
```

```js
import multiband from '@audio/dynamics-multiband'
```

Multiband compressor — Linkwitz-Riley crossover split, an independent [compressor](#compressor) per band (upward half included), flat sum by construction (SoX `mcompand` class). The manifest (`multiband/audio`) is a 3-band "one-knob" mastering stage — one shared setting across low/mid/high, split at `low`/`high`. The kernel (`multiband(data, opts)`) takes N-1 crossover points and per-band settings directly, for full control; every `bands` entry is spread straight into `compressor()`, so upward compression and `depth` are already there per band.

```js
import { multiband } from '@audio/dynamics'

// one-knob: shared setting across 3 bands split at 200/2000 Hz
multiband(data, { freqs: [200, 2000], bands: { threshold: -24, ratio: 3 } })

// per-band settings, N bands (mutates data in place)
multiband(data, {
  freqs: [400, 4000],
  bands: [
    { threshold: -24, ratio: 3 },               // low
    { threshold: -20, ratio: 4, makeup: 2 },     // mid
    null,                                        // high: pass through uncompressed
  ],
})
```

**OTT-class upward+downward multiband** — [Xfer OTT](https://xferrecords.com/products/ott)'s "upward + downward compression on 3 bands" recipe, reproduced with this atom's `upThreshold`/`upRatio`/`depth`:

```js
let depth = 1   // OTT's "Depth" macro — 0 is a transparent pass, 1 is full effect, up to 2 overshoots it
multiband(data, {
  freqs: [88.3, 2500],   // OTT's own crossover points
  bands: [
    { threshold: -24, ratio: 4, upThreshold: -30, upRatio: 2, attack: 2, release: 35, depth },  // low
    { threshold: -24, ratio: 4, upThreshold: -30, upRatio: 2, attack: 5, release: 60, depth },  // mid
    { threshold: -24, ratio: 4, upThreshold: -30, upRatio: 2, attack: 2, release: 35, depth },  // high
  ],
})
```

| Param | Default | |
|---|---|---|
| `freqs` | `[200, 2000]` | Hz, N-1 crossover points for N bands |
| `bands` | — | per-band `{threshold, ratio, knee, attack, release, makeup, upThreshold, upRatio, upKnee, upRange, depth}`, or one object shared by all bands; `null` passes a band through uncompressed |
| `order` | `4` | Linkwitz-Riley crossover order (2, 4, 8) |
| `fs` | `44100` | Hz |

Manifest params (3-band one-knob form): `low`, `high`, `threshold`, `ratio`, `upThreshold`, `upRatio`, `depth`, `attack`, `release`, `makeup`.

**Use when:** mastering-stage glue across the spectrum; OTT-style "upward + downward everywhere" aggressive multiband; taming one band without touching others.<br>
**Not for:** single-band dynamics — use [compressor](#compressor) directly.

---

Part of [@audio/dynamics](https://github.com/audiojs/dynamics) — the dynamics family umbrella. This README is generated from the umbrella docs.

MIT © [audiojs](https://github.com/audiojs)
