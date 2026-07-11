# @audio/dynamics-vca [![npm](https://img.shields.io/npm/v/@audio/dynamics-vca)](https://www.npmjs.com/package/@audio/dynamics-vca) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

VCA compressor model (dbx/SSL-bus class) — clean feed-forward, near-hard knee

```
npm install @audio/dynamics-vca
```

```js
import vca from '@audio/dynamics-vca'
```

Clean feed-forward peak-detecting compressor after dbx/SSL-bus VCA topology: precise dB-linear gain computation, near-hard `1 dB` knee, fast `1 ms` attack. The transparent workhorse of the family — same [`compressorGain`](https://github.com/audiojs/dynamics#compressor) curve as `compressor`, tuned for speed and neutrality rather than character.

```js
vca(data, { threshold: -20, ratio: 4 })                 // batch
vca(data)                                                  // defaults

let write = vca({ threshold: -20, ratio: 4 })            // streaming
let out1 = write(block1)
let tail = write()                                         // flush
```

| Param | Default | |
|---|---|---|
| `threshold` | `-20` | dB |
| `ratio` | `4` | — |
| `knee` | `1` | dB (near-hard) |
| `attack` | `1` | ms |
| `release` | `150` | ms |
| `makeup` | `0` | dB |
| `sampleRate` | `44100` | Hz (alias `fs`) |

**Use when:** mix bus glue, precise transparent gain reduction without coloration.<br>
**Not for:** vintage character — use [`opto`](https://github.com/audiojs/dynamics-opto) or [`varimu`](https://github.com/audiojs/dynamics-varimu).

---

Part of [@audio/dynamics](https://github.com/audiojs/dynamics) — the dynamics family umbrella.

MIT © [audiojs](https://github.com/audiojs)
