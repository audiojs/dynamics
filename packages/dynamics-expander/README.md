# @audio/dynamics-expander [![npm](https://img.shields.io/npm/v/@audio/dynamics-expander)](https://www.npmjs.com/package/@audio/dynamics-expander) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Downward expander: reduces gain below threshold by (T-L)·(ratio-1) dB,

```
npm install @audio/dynamics-expander
```

```js
import expander from '@audio/dynamics-expander'
```

Downward expander (`mode: 'downward'`, default) — a softer gate. Below threshold, gain is reduced by `(threshold − level) × (ratio − 1)` dB, clamped at `range`.

`mode: 'upward'` switches to **upward expansion** — the de-compression complement, raising gain *above* threshold instead of cutting it below. Classical substrate for de-limiting: transient-aware upward expansion restores crest factor a brickwall limiter (or an over-eager mix bus compressor) flattened. Same four-quadrant taxonomy as [compressor](#compressor)'s upward mode (Giannoulis/Reiss; Izhaki, *Mixing Audio*).

```js
import { expander } from '@audio/dynamics'

expander(data, { threshold: -30, ratio: 2 })

// de-limiting: expand transients back out above threshold
expander(data, { mode: 'upward', threshold: -20, ratio: 1.5, range: 20 })
```

| Param | Default | |
|---|---|---|
| `mode` | `'downward'` | `'downward'` \| `'upward'` |
| `threshold` | `-30` | dB |
| `ratio` | `2` | — |
| `knee` | `6` | dB |
| `range` | `-40` (downward) / `20` (upward) | dB, max reduction (downward, negative) or max lift (upward, positive) |
| `attack` | `5` | ms |
| `release` | `50` | ms |

**Use when:** gentle noise-floor suppression without the abruptness of a gate (`downward`); restoring dynamics to over-compressed or over-limited material (`upward`).<br>
**Not for:** hard removal of sound between phrases — use [gate](#gate).

---

Part of [@audio/dynamics](https://github.com/audiojs/dynamics) — the dynamics family umbrella. This README is generated from the umbrella docs.

MIT © [audiojs](https://github.com/audiojs)
