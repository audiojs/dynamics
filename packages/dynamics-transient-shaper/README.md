# @audio/dynamics-transient-shaper [![npm](https://img.shields.io/npm/v/@audio/dynamics-transient-shaper)](https://www.npmjs.com/package/@audio/dynamics-transient-shaper) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Transient shaper — independently boosts/cuts attack and sustain portions (SPL Transient Designer class)

```
npm install @audio/dynamics-transient-shaper
```

```js
import transientShaper from '@audio/dynamics-transient-shaper'
```

A level follower (1 ms attack, 100 ms release) and a slow copy of it (50 ms attack) separate transient from sustain: `transient = (level − slow) / level`, from 0 to 1: near 1 on attacks, near 0 on held material. Output gain is `1 + attackGain·transient + sustainGain·(1 − transient)`, a linear multiplier (not dB) that stays between `1 + attackGain` and `1 + sustainGain`: `attackGain: 1` roughly doubles attack peaks, `attackGain: -1` can null them out. Mutates `data` in place and returns it; no separate streaming factory — pass the same `params` object across calls (it carries `_envFast`/`_envSlow`) to continue state across chunks.

```js
transientShaper(data, { attackGain: 0.5, sustainGain: -0.3 })   // punchier attacks, tucked sustain
transientShaper(data, { attackGain: -0.5 })                       // soften/glue transients

let params = { attackGain: 0.5 }
transientShaper(block1, params)                                   // state carried in `params`
transientShaper(block2, params)
```

| Param | Default | |
|---|---|---|
| `attackGain` | `0` | linear gain delta on the transient portion (not dB) |
| `sustainGain` | `0` | linear gain delta on the sustain portion (not dB) |
| `fs` | `44100` | Hz |

**Use when:** drum punch/glue, percussive attack shaping without a threshold to tune.<br>
**Not for:** level-controlled dynamics — use [`compressor`](https://github.com/audiojs/dynamics#compressor) or [`unlimit`](https://github.com/audiojs/dynamics#unlimit) for deficit-gated transient restoration.

---

Part of [@audio/dynamics](https://github.com/audiojs/dynamics) — the dynamics family umbrella.

MIT © [audiojs](https://github.com/audiojs)
