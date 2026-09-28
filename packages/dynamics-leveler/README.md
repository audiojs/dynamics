# @audio/dynamics-leveler [![npm](https://img.shields.io/npm/v/@audio/dynamics-leveler)](https://www.npmjs.com/package/@audio/dynamics-leveler) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Gain-riding dialogue leveler — framewise loudness normalization (FFmpeg dynaudnorm / Waves Vocal Rider class)

```
npm install @audio/dynamics-leveler
```

```js
import leveler from '@audio/dynamics-leveler'
```

Framewise RMS is measured and converted to a gain toward `target`; frames `gate` dB under the speech are pauses and hold the speech gain, so the room between phrases stays where it was under the voice. Gains are gaussian-smoothed across frame neighbors, then peak-guarded so no sample is pushed past −0.5 dBFS. Gain is linearly interpolated between frame centers and applied in place. **Batch only, non-causal by design** — the smoothing looks at frames on both sides of each point, so there is no streaming form.

```js
leveler(data)                                    // target -20 dB, mutates and returns data
leveler(data, { target: -18, frame: 0.3, maxGain: 9, smooth: 3 })
```

| Param | Default | |
|---|---|---|
| `fs` | `44100` | Hz |
| `target` | `-20` | dB, RMS loudness target |
| `frame` | `0.5` | s, analysis window |
| `maxGain` | `12` | dB, symmetric gain clamp per frame |
| `smooth` | `5` | frames, gaussian smoothing radius |
| `gate` | `20` | dB: frames this far under the speech are pauses and hold the speech gain |

**Use when:** dialogue/podcast loudness riding, evening out a take without pumping.<br>
**Not for:** real-time/streaming use (no streaming form) — use [`compressor`](https://github.com/audiojs/dynamics#compressor) or [`compand`](https://github.com/audiojs/dynamics#compand) for causal leveling.

---

Part of [@audio/dynamics](https://github.com/audiojs/dynamics) — the dynamics family umbrella.

MIT © [audiojs](https://github.com/audiojs)
