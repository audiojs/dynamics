# @audio/dynamics-varimu [![npm](https://img.shields.io/npm/v/@audio/dynamics-varimu)](https://www.npmjs.com/package/@audio/dynamics-varimu) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Vari-Mu compressor model (Fairchild class) — feedback detection, drive-dependent ratio, soft wide knee

```
npm install @audio/dynamics-varimu
```

```js
import varimu from '@audio/dynamics-varimu'
```

Models a Fairchild 670-style vari-mu tube compressor: **feedback topology** — the RMS detector reads the already-compressed output, not the input, which is what gives vari-mu units their characteristic self-limiting smoothness. Ratio ("mu") is not fixed: it grows from `1.8` with drive above threshold (`mu = 1.8 + max(0, overDb) / 5`), through a `15 dB` soft knee.

```js
varimu(data, { threshold: -22 })                 // batch
varimu(data)                                        // defaults

let write = varimu({ threshold: -22 })            // streaming
let out1 = write(block1)
let tail = write()                                  // flush
```

| Param | Default | |
|---|---|---|
| `threshold` | `-22` | dB |
| `knee` | `15` | dB (wide) |
| `attack` | `25` | ms |
| `release` | `400` | ms |
| `makeup` | `0` | dB |
| `sampleRate` | `44100` | Hz (alias `fs`) |

Ratio is derived, not settable — pass `threshold`/`knee` to shape where and how gradually it grows.

**Use when:** bus glue, mastering — slow, smooth, self-limiting gain reduction with tube-like character.<br>
**Not for:** fast peak control — use [`fet`](https://github.com/audiojs/dynamics-fet) or [`limiter`](https://github.com/audiojs/dynamics#limiter).

---

Part of [@audio/dynamics](https://github.com/audiojs/dynamics) — the dynamics family umbrella.

MIT © [audiojs](https://github.com/audiojs)
