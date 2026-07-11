# @audio/dynamics-ducker [![npm](https://img.shields.io/npm/v/@audio/dynamics-ducker)](https://www.npmjs.com/package/@audio/dynamics-ducker) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

External-sidechain compressor: main signal's gain is reduced in proportion

```
npm install @audio/dynamics-ducker
```

```js
import ducker from '@audio/dynamics-ducker'
```

External-sidechain compressor. Main signal's gain tracks the level of a separate side signal.

```js
import { ducker } from '@audio/dynamics'

// batch
let podcast = ducker(music, voice, { threshold: -30, range: -12 })

// streaming — callable takes (main, side); call with no args to flush
let duck = ducker({ threshold: -30, range: -15 })
let out1 = duck(musicBlock1, voiceBlock1)
let out2 = duck(musicBlock2, voiceBlock2)
let tail = duck()
```

| Param | Default | |
|---|---|---|
| `threshold` | `-30` | dB (on side level) |
| `ratio` | `4` | — |
| `knee` | `6` | dB |
| `range` | `-24` | dB, max reduction |
| `attack` | `20` | ms |
| `release` | `300` | ms |

**Use when:** music-under-voice podcasts, dialogue ducking, sidechain-pumped mixes.<br>
**Not for:** sidechain from the same signal — use [compressor](#compressor).

---

Part of [@audio/dynamics](https://github.com/audiojs/dynamics) — the dynamics family umbrella. This README is generated from the umbrella docs.

MIT © [audiojs](https://github.com/audiojs)
