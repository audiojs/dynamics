# @audio/dynamics-compand [![npm](https://img.shields.io/npm/v/@audio/dynamics-compand)](https://www.npmjs.com/package/@audio/dynamics-compand) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Multi-segment compander (SoX `compand`). Arbitrary piecewise-linear transfer

```
npm install @audio/dynamics-compand
```

```js
import compand from '@audio/dynamics-compand'
```

SoX-style multi-segment compander. Arbitrary piecewise-linear transfer in dB unifies compression, expansion, and gating under one curve — points below the identity line compress; above, they expand.

```js
import { compand } from '@audio/dynamics'

// Default: compress above -20 dB
compand(data)

// Broadcast leveler: lift -40..-20 dB, compress above -10 dB
compand(data, {
  points: [[-90, -90], [-40, -30], [-20, -18], [-10, -10], [0, -4]],
  attack: 20, release: 500
})
```

| Param | Default | |
|---|---|---|
| `points` | `[[-90,-90],[-60,-60],[-20,-20],[0,-8]]` | `[[inDb, outDb], ...]` |
| `attack` | `5` | ms |
| `release` | `200` | ms |

**Use when:** broadcast leveling, speech normalization, any time a single compressor's fixed ratio is too rigid.<br>
**Not for:** simple threshold compression — use [compressor](#compressor).

---

Part of [@audio/dynamics](https://github.com/audiojs/dynamics) — the dynamics family umbrella. This README is generated from the umbrella docs.

MIT © [audiojs](https://github.com/audiojs)
