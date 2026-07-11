# @audio/dynamics-envelope [![npm](https://img.shields.io/npm/v/@audio/dynamics-envelope)](https://www.npmjs.com/package/@audio/dynamics-envelope) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Branching one-pole envelope follower. Returns a stateful per-sample detector

```
npm install @audio/dynamics-envelope
```

```js
import envelope from '@audio/dynamics-envelope'
```

Every processor except `softclip` is built on this: a branching one-pole follower with separate attack/release time constants, peak or RMS detection.

```js
import { envelope } from '@audio/dynamics'

let follow = envelope({ attack: 5, release: 100, detector: 'peak' })
let level = []
for (let x of samples) level.push(follow(x))
```

| Param | Default | |
|---|---|---|
| `sampleRate` | `44100` | — |
| `attack` | `5` | ms |
| `release` | `50` | ms |
| `detector` | `'peak'` | `'peak'` or `'rms'` |
| `rmsWindow` | `256` | samples, for RMS detector |

---

Part of [@audio/dynamics](https://github.com/audiojs/dynamics) — the dynamics family umbrella. This README is generated from the umbrella docs.

MIT © [audiojs](https://github.com/audiojs)
