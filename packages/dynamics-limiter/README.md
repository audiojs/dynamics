# @audio/dynamics-limiter [![npm](https://img.shields.io/npm/v/@audio/dynamics-limiter)](https://www.npmjs.com/package/@audio/dynamics-limiter) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Lookahead brickwall limiter. A sliding-window maximum (monotonic deque) over

```
npm install @audio/dynamics-limiter
```

```js
import limiter from '@audio/dynamics-limiter'
```

Lookahead brickwall limiter. The gain each sample needs, its sliding minimum over the lookahead span and that minimum's moving average: the gain ramps down across `lookahead` ms into a peak, never stepping, and still covers every sample in transit; exponential release after it passes.

```js
import limiter from '@audio/dynamics-limiter'

limiter(data, { ceiling: -0.3 })
limiter(data, { ceiling: -1, lookahead: 10, release: 100 })
limiter(data, { ceiling: -1, truePeak: true })   // dBTP: the waveform between samples too
```

| Param | Default | |
|---|---|---|
| `ceiling` | `-0.3` | dB (brickwall) |
| `lookahead` | `5` | ms (introduces delay) |
| `release` | `50` | ms |
| `truePeak` | `false` | hold the reconstructed waveform under the ceiling, not only its samples (ITU-R BS.1770 Annex 2): each interval read at 8 points through a 96-tap Kaiser sinc; 96 samples more delay |

**Use when:** peak control at the master bus; `truePeak` for a delivery spec in dBTP (streaming's -1 dBTP, EBU R128's -1), where a DAC or a lossy decoder rebuilds peaks up to 3 dB over the samples. Full-band noise limited 20 dB stays within 0.005 dB of the ceiling, band-limited, with 16 samples of lookahead or more.<br>
**Not for:** musical dynamics shaping — use [compressor](#compressor). Low-latency paths — use [softclip](#softclip).

---

Part of [@audio/dynamics](https://github.com/audiojs/dynamics) — the dynamics family umbrella. This README is generated from the umbrella docs.

MIT © [audiojs](https://github.com/audiojs)
