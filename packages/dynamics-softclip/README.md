# @audio/dynamics-softclip [![npm](https://img.shields.io/npm/v/@audio/dynamics-softclip)](https://www.npmjs.com/package/@audio/dynamics-softclip) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Static waveshaping — no envelope, no time state. Deterministic per-sample

```
npm install @audio/dynamics-softclip
```

```js
import softclip from '@audio/dynamics-softclip'
```

Static waveshaping — no time state, no pumping. Maps input through a fixed transfer curve; peaks saturate smoothly, introducing controlled harmonic content.

Hard/high-drive clipping generates harmonics above Nyquist that fold back as audible aliasing. `oversample` (1/2/4/8, default `1`) runs the transfer at N× rate and decimates back down through a windowed-sinc anti-alias filter, same technique as [`@audio/saturate`](https://github.com/audiojs/saturate)'s oversampled shapers — `oversample: 1` is the exact non-oversampled path (no resampling, zero cost).

```js
import { softclip } from '@audio/dynamics'

softclip(data, { curve: 'tanh', drive: 1.5 })
softclip(data, { curve: 'cubic', drive: 2, ceiling: 0.9 })
softclip(data, { curve: 'hard', drive: 4, oversample: 4, fs: 44100 })   // clean high-drive clip
```

| Param | Default | |
|---|---|---|
| `curve` | `'tanh'` | `'tanh'`, `'atan'`, `'cubic'`, `'sin'`, `'hard'` |
| `drive` | `1` | input pre-gain |
| `ceiling` | `1` | output asymptote |
| `oversample` | `1` | `1`, `2`, `4`, `8` — anti-aliased oversampling |
| `fs` | `44100` | Hz, sample rate (only used when `oversample > 1`) |

**Use when:** gentle peak control with musical saturation, avoiding pumping artifacts of a limiter, lo-fi character; `oversample` for hard/high-drive clipping that must stay alias-free.<br>
**Not for:** transparent true-peak safety — use [limiter](#limiter). Clean gain reduction — use [compressor](#compressor).

---

Part of [@audio/dynamics](https://github.com/audiojs/dynamics) — the dynamics family umbrella. This README is generated from the umbrella docs.

MIT © [audiojs](https://github.com/audiojs)
