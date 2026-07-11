# @audio/dynamics-deesser [![npm](https://img.shields.io/npm/v/@audio/dynamics-deesser)](https://www.npmjs.com/package/@audio/dynamics-deesser) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

De-esser: bandpass sidechain (sibilance band) drives a compressor whose gain

```
npm install @audio/dynamics-deesser
```

```js
import deesser from '@audio/dynamics-deesser'
```

Sibilance reduction, two architectures behind `mode`: **broadband** (default) — a biquad bandpass drives the envelope follower and the gain reduction is applied broadband; simple and transparent. **band** — an HP-filtered sidechain drives a dynamic peaking EQ at `freq`, so only the sibilance band is cut and program below it stays untouched even during deep reduction (wideband/split-band precedent).

```js
import { deesser } from '@audio/dynamics'

deesser(data, { freq: 6500, threshold: -20 })
deesser(data, { freq: 5500, q: 3, threshold: -24, ratio: 6 })
deesser(data, { mode: 'band', freq: 7000, threshold: -30, ratio: 8 })
```

| Param | Default | |
|---|---|---|
| `mode` | `'broadband'` | `'broadband'` \| `'band'` |
| `freq` | `6500` | Hz, sibilance center |
| `q` | `2` | bandpass Q (broadband) / `1.4` peaking-cut Q (band) |
| `threshold` | `-20` | dB (on sidechain level) |
| `ratio` | `4` | — |
| `knee` | `6` | dB (broadband only) |
| `attack` | `1` | ms |
| `release` | `40` | ms |

**Use when:** harsh 's' / 't' / 'sh' in close-miked voice, bright vocal takes; `mode: 'band'` when the voice sits with program that must not pump.<br>
**Not for:** broadband brightness — use an EQ. Generic compression — use [compressor](#compressor).

---

Part of [@audio/dynamics](https://github.com/audiojs/dynamics) — the dynamics family umbrella. This README is generated from the umbrella docs.

MIT © [audiojs](https://github.com/audiojs)
