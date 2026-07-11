# @audio/dynamics-gate [![npm](https://img.shields.io/npm/v/@audio/dynamics-gate)](https://www.npmjs.com/package/@audio/dynamics-gate) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Noise gate with hold-then-close logic and smoothed gain transitions

```
npm install @audio/dynamics-gate
```

```js
import gate from '@audio/dynamics-gate'
```

Noise gate with hysteresis, hold-then-close logic and look-ahead. Opens above `threshold`, closes only below `closeThreshold` (hysteresis prevents chatter around a single threshold); below it, signal is attenuated by `range` dB. A `hold` timer keeps the gate open after a drop-out; attack/release smooth the gain transitions. `lookahead` runs detection ahead of emission so the gate is already opening when a transient reaches the output — batch calls stay sample-aligned (no silence prefix, no dropped tail); block hosts get the delay declared as atom `latency`.

```js
import { gate } from '@audio/dynamics'

gate(data, { threshold: -40 })
gate(data, { threshold: -35, range: -80, hold: 20, attack: 1, release: 150, lookahead: 5 })
```

| Param | Default | |
|---|---|---|
| `threshold` | `-40` | dB, open above |
| `closeThreshold` | `threshold − 6` | dB, close below (hysteresis) |
| `range` | `-60` | dB attenuation when closed |
| `hold` | `10` | ms |
| `attack` | `0.1` | ms (opening) |
| `release` | `100` | ms (closing) |
| `lookahead` | `0` | ms, detection leads emission |

**Use when:** drum mics, voice dialogue with ambient noise, removing hiss between phrases.<br>
**Not for:** subtle low-level reduction — use [expander](#expander).

---

Part of [@audio/dynamics](https://github.com/audiojs/dynamics) — the dynamics family umbrella. This README is generated from the umbrella docs.

MIT © [audiojs](https://github.com/audiojs)
