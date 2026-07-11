# @audio/dynamics-fet [![npm](https://img.shields.io/npm/v/@audio/dynamics-fet)](https://www.npmjs.com/package/@audio/dynamics-fet) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

FET compressor model (1176 class) — 0.2 ms peak attack, high ratios, firm knee

```
npm install @audio/dynamics-fet
```

```js
import fet from '@audio/dynamics-fet'
```

Very fast peak-detecting feed-forward compressor after the UREI 1176 topology (same soft-knee gain curve as [`@audio/dynamics-compressor`](https://github.com/audiojs/dynamics), tuned to the 1176's character: sub-millisecond attack, firm 3 dB knee, high ratio). Character comes from speed, not coloration — no saturation modeling.

```js
fet(data, { threshold: -18, ratio: 8 })                 // batch
fet(data)                                                 // defaults

let write = fet({ threshold: -18, ratio: 8 })            // streaming
let out1 = write(block1)
let tail = write()                                        // flush
```

| Param | Default | |
|---|---|---|
| `threshold` | `-18` | dB |
| `ratio` | `8` | — |
| `knee` | `3` | dB (firm) |
| `attack` | `0.2` | ms |
| `release` | `120` | ms |
| `makeup` | `0` | dB |
| `sampleRate` | `44100` | Hz (alias `fs`) |

**Use when:** drums, bass, aggressive vocal — fast peak-catching character with an audible "grab".<br>
**Not for:** transparent leveling — use [`compressor`](https://github.com/audiojs/dynamics#compressor) or [`vca`](https://github.com/audiojs/dynamics-vca).

---

Part of [@audio/dynamics](https://github.com/audiojs/dynamics) — the dynamics family umbrella.

MIT © [audiojs](https://github.com/audiojs)
