# @audio/dynamics-opto [![npm](https://img.shields.io/npm/v/@audio/dynamics-opto)](https://www.npmjs.com/package/@audio/dynamics-opto) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Optical compressor model (LA-2A class) — RMS detection, wide soft knee, program-dependent release

```
npm install @audio/dynamics-opto
```

```js
import opto from '@audio/dynamics-opto'
```

Models a Teletronix LA-2A-style electro-optical gain cell: RMS-detected soft-knee compression (`~3:1`, wide `10 dB` knee) plus the T4 cell's signature — release time that slows the longer gain reduction persists. An internal ~3 s memory of time-under-reduction stretches `release` up to 7× on sustained material, then relaxes back toward the nominal value once the signal clears.

```js
opto(data, { threshold: -20, ratio: 3 })                 // batch
opto(data)                                                 // defaults

let write = opto({ threshold: -20, ratio: 3 })            // streaming
let out1 = write(block1)
let tail = write()                                         // flush
```

| Param | Default | |
|---|---|---|
| `threshold` | `-20` | dB |
| `ratio` | `3` | — |
| `knee` | `10` | dB (wide) |
| `attack` | `10` | ms |
| `release` | `300` | ms (nominal; program-dependent stretch multiplies this up to 7×) |
| `makeup` | `0` | dB |
| `sampleRate` | `44100` | Hz (alias `fs`) |

**Use when:** vocals, bass — smooth, program-dependent gain riding without pumping.<br>
**Not for:** fast peak-catching character — use [`fet`](https://github.com/audiojs/dynamics-fet). Aggressive drive-dependent ratio — use [`varimu`](https://github.com/audiojs/dynamics-varimu).

---

Part of [@audio/dynamics](https://github.com/audiojs/dynamics) — the dynamics family umbrella.

MIT © [audiojs](https://github.com/audiojs)
