# @audio/dynamics-limiter [![npm](https://img.shields.io/npm/v/@audio/dynamics-limiter)](https://www.npmjs.com/package/@audio/dynamics-limiter) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Lookahead brickwall limiter. A sliding-window maximum (monotonic deque) over

```
npm install @audio/dynamics-limiter
```

```js
import limiter from '@audio/dynamics-limiter'
```

Lookahead brickwall limiter. A sliding-window maximum over the lookahead span drives the envelope, so gain reduction always covers every sample in transit — instant attack `lookahead` ms before a peak emerges, exponential release after it passes.

```js
import { limiter } from '@audio/dynamics'

limiter(data, { ceiling: -0.3 })
limiter(data, { ceiling: -1, lookahead: 10, release: 100 })
```

| Param | Default | |
|---|---|---|
| `ceiling` | `-0.3` | dB (brickwall) |
| `lookahead` | `5` | ms (introduces delay) |
| `release` | `50` | ms |

**Use when:** master bus ceiling, true-peak safety, preventing inter-sample clipping.<br>
**Not for:** musical dynamics shaping — use [compressor](#compressor). Low-latency paths — use [softclip](#softclip).

---

Part of [@audio/dynamics](https://github.com/audiojs/dynamics) — the dynamics family umbrella. This README is generated from the umbrella docs.

MIT © [audiojs](https://github.com/audiojs)
