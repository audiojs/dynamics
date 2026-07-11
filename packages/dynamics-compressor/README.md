# @audio/dynamics-compressor [![npm](https://img.shields.io/npm/v/@audio/dynamics-compressor)](https://www.npmjs.com/package/@audio/dynamics-compressor) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Feed-forward soft-knee compressor (Giannoulis-Massberg topology)

```
npm install @audio/dynamics-compressor
```

```js
import compressor from '@audio/dynamics-compressor'
```

Feed-forward soft-knee downward compressor — Giannoulis-Massberg topology. Envelope → log domain → quadratic soft-knee gain curve → linear gain applied to input.

Downward compression (above threshold, reduces gain) is one half of the canonical four-quadrant dynamics taxonomy — downward/upward compression, downward/upward expansion (Giannoulis, Massberg & Reiss 2012; Izhaki, *Mixing Audio*). Setting `upThreshold` engages the other compression half: **upward compression** lifts quiet passages *toward* the threshold instead of squashing loud ones — the "OTT up" half popularized by Xfer OTT. Both curves read the same envelope and sum in the dB domain, so a single compressor call can glue loud material down and lift quiet material up at once.

```js
import { compressor } from '@audio/dynamics'

compressor(data, { threshold: -18, ratio: 4 })
compressor(data, { threshold: -24, ratio: 2, knee: 12, attack: 10, release: 200, makeup: 6 })

// upward + downward together (OTT-style): lift quiet passages, squash loud ones
compressor(data, { threshold: -18, ratio: 4, upThreshold: -40, upRatio: 2, upRange: 12 })
```

| Param | Default | |
|---|---|---|
| `threshold` | `-20` | dB |
| `ratio` | `4` | — |
| `knee` | `6` | dB (soft-knee width) |
| `attack` | `5` | ms |
| `release` | `100` | ms |
| `makeup` | `0` | dB |
| `depth` | `1` | scales the summed up+down gain before makeup (OTT "Depth" macro; `0` = identity) |
| `upThreshold` | `null` | dB; `null` disables upward compression |
| `upRatio` | `2` | — (`1` is a mathematical no-op) |
| `upKnee` | `6` | dB |
| `upRange` | `12` | dB, max upward lift — without a ceiling, silence would take unbounded gain |

**Use when:** vocals, bass, drum bus, mix glue; add `upThreshold` for OTT-style up+down "aggressive" glue.<br>
**Not for:** peak control at the master bus — use [limiter](#limiter). Transparent loudness shaping — use [compand](#compand) with gentle slope.

---

Part of [@audio/dynamics](https://github.com/audiojs/dynamics) — the dynamics family umbrella. This README is generated from the umbrella docs.

MIT © [audiojs](https://github.com/audiojs)
