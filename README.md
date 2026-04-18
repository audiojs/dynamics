## dynamics-processor [![test](https://github.com/audiojs/dynamics-processor/actions/workflows/test.yml/badge.svg)](https://github.com/audiojs/dynamics-processor/actions/workflows/test.yml) [![npm](https://img.shields.io/npm/v/dynamics-processor)](https://npmjs.org/dynamics-processor) [![license](https://img.shields.io/badge/license-MIT-green.svg)](https://github.com/audiojs/dynamics-processor/blob/main/LICENSE)

Dynamics processing — compressor, limiter, gate, expander, de-esser, ducker, softclip, compand. All built on a single branching envelope follower; differences are purely in the gain curve. Part of [audiojs](https://github.com/audiojs).

| | Kind | Gain function | Typical use |
|---|---|---|---|
| [compressor](#compressor) | envelope | soft-knee above threshold | leveling vocals, mix glue |
| [limiter](#limiter) | lookahead | brickwall at ceiling | master bus, peak control |
| [gate](#gate) | envelope | hard cut below threshold | silence between phrases |
| [expander](#expander) | envelope | gentle below-threshold reduction | soft gating, noise bed shaping |
| [deesser](#deesser) | sidechain | compressor on sibilance band | harsh 's' / 't' in voice |
| [ducker](#ducker) | ext. sidechain | compressor keyed by side signal | music-under-voice, podcast |
| [softclip](#softclip) | waveshaper | static transfer curve | gentle peak limiting + coloration |
| [compand](#compand) | envelope | piecewise-linear transfer | SoX-style multi-segment |


## Usage

```
npm install dynamics-processor
```

```js
import { compressor, limiter, gate, ducker } from 'dynamics-processor'

let glued = compressor(samples, { threshold: -18, ratio: 4, attack: 5, release: 100 })
let safe = limiter(glued, { ceiling: -0.3, lookahead: 5 })

let write = compressor({ threshold: -18, ratio: 4 })    // streaming
write(block1)
write(block2)
write()                                                  // → remaining samples

let ducked = ducker(music, voice, { threshold: -30, range: -12 })
```

> Mono `Float32Array` in/out. For stereo, process channels independently or feed a linked detector. Sample rate defaults to 44100; pass `sampleRate` for anything else.


## envelope

Every processor except `softclip` is built on this: a branching one-pole follower with separate attack/release time constants, peak or RMS detection.

```js
import { envelope } from 'dynamics-processor'

let follow = envelope({ attack: 5, release: 100, detector: 'peak' })
for (let x of samples) level.push(follow(x))
```

| Param | Default | |
|---|---|---|
| `sampleRate` | `44100` | — |
| `attack` | `5` | ms |
| `release` | `50` | ms |
| `detector` | `'peak'` | `'peak'` or `'rms'` |
| `rmsWindow` | `256` | samples, for RMS detector |


## compressor

Feed-forward soft-knee downward compressor — Giannoulis-Massberg topology. Envelope → log domain → quadratic soft-knee gain curve → linear gain applied to input.

```js
import { compressor } from 'dynamics-processor'

compressor(data, { threshold: -18, ratio: 4 })
compressor(data, { threshold: -24, ratio: 2, knee: 12, attack: 10, release: 200, makeup: 6 })
```

| Param | Default | |
|---|---|---|
| `threshold` | `-20` | dB |
| `ratio` | `4` | — |
| `knee` | `6` | dB (soft-knee width) |
| `attack` | `5` | ms |
| `release` | `100` | ms |
| `makeup` | `0` | dB |

**Use when:** vocals, bass, drum bus, mix glue.<br>
**Not for:** peak control at the master bus — use [limiter](#limiter). Transparent loudness shaping — use [compand](#compand) with gentle slope.


## limiter

Lookahead brickwall limiter. Peak-hold envelope with exponential release; input delayed by `lookahead` ms so gain reduction lands before the peak emerges.

```js
import { limiter } from 'dynamics-processor'

limiter(data, { ceiling: -0.3 })
limiter(data, { ceiling: -1, lookahead: 10, release: 100 })
```

| Param | Default | |
|---|---|---|
| `ceiling` | `-0.3` | dB (brickwall) |
| `lookahead` | `5` | ms (introduces delay) |
| `release` | `50` | ms |

**Use when:** master bus ceiling, true-peak safety, preventing inter-sample clipping.<br>
**Not for:** musical dynamics shaping — use [compressor](#compressor). Low-latency paths — use [softclip](#softclip).


## gate

Noise gate with hold-then-close logic. Below threshold, signal is attenuated by `range` dB. A `hold` timer keeps the gate open after a drop-out to avoid chatter; attack/release smooth the gain transitions.

```js
import { gate } from 'dynamics-processor'

gate(data, { threshold: -40 })
gate(data, { threshold: -35, range: -80, hold: 20, attack: 1, release: 150 })
```

| Param | Default | |
|---|---|---|
| `threshold` | `-40` | dB |
| `range` | `-60` | dB attenuation when closed |
| `hold` | `10` | ms |
| `attack` | `0.1` | ms (opening) |
| `release` | `100` | ms (closing) |

**Use when:** drum mics, voice dialogue with ambient noise, removing hiss between phrases.<br>
**Not for:** subtle low-level reduction — use [expander](#expander).


## expander

Downward expander — a softer gate. Below threshold, gain is reduced by `(threshold − level) × (ratio − 1)` dB, clamped at `range`.

```js
import { expander } from 'dynamics-processor'

expander(data, { threshold: -30, ratio: 2 })
```

| Param | Default | |
|---|---|---|
| `threshold` | `-30` | dB |
| `ratio` | `2` | — |
| `knee` | `6` | dB |
| `range` | `-40` | dB, max reduction |
| `attack` | `5` | ms |
| `release` | `50` | ms |

**Use when:** gentle noise-floor suppression without the abruptness of a gate.<br>
**Not for:** hard removal of sound between phrases — use [gate](#gate).


## deesser

Sibilance compressor. A biquad bandpass drives the envelope follower; the resulting gain reduction is applied broadband. Simple and transparent.

```js
import { deesser } from 'dynamics-processor'

deesser(data, { freq: 6500, threshold: -20 })
deesser(data, { freq: 5500, q: 3, threshold: -24, ratio: 6 })
```

| Param | Default | |
|---|---|---|
| `freq` | `6500` | Hz, sibilance center |
| `q` | `2` | bandpass Q |
| `threshold` | `-20` | dB (on sidechain level) |
| `ratio` | `4` | — |
| `knee` | `6` | dB |
| `attack` | `1` | ms |
| `release` | `40` | ms |

**Use when:** harsh 's' / 't' / 'sh' in close-miked voice, bright vocal takes.<br>
**Not for:** broadband brightness — use an EQ. Generic compression — use [compressor](#compressor).


## ducker

External-sidechain compressor. Main signal's gain tracks the level of a separate side signal.

```js
import { ducker } from 'dynamics-processor'

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


## softclip

Static waveshaping — no time state, no pumping. Maps input through a fixed transfer curve; peaks saturate smoothly, introducing controlled harmonic content.

```js
import { softclip } from 'dynamics-processor'

softclip(data, { curve: 'tanh', drive: 1.5 })
softclip(data, { curve: 'cubic', drive: 2, ceiling: 0.9 })
```

| Param | Default | |
|---|---|---|
| `curve` | `'tanh'` | `'tanh'`, `'atan'`, `'cubic'`, `'sin'`, `'hard'` |
| `drive` | `1` | input pre-gain |
| `ceiling` | `1` | output asymptote |

**Use when:** gentle peak control with musical saturation, avoiding pumping artifacts of a limiter, lo-fi character.<br>
**Not for:** transparent true-peak safety — use [limiter](#limiter). Clean gain reduction — use [compressor](#compressor).


## compand

SoX-style multi-segment compander. Arbitrary piecewise-linear transfer in dB unifies compression, expansion, and gating under one curve — points below the identity line compress; above, they expand.

```js
import { compand } from 'dynamics-processor'

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


## See also

* [noise-reduction](https://github.com/audiojs/noise-reduction) — gate belongs here too; umbrella for everything noise
* [audio-filter](https://github.com/audiojs/audio-filter) — biquads for deesser sidechain
* [audio-effect](https://github.com/audiojs/audio-effect) — modulation effects
* [time-stretch](https://github.com/audiojs/time-stretch) — sibling package


## References

* Giannoulis, D., Massberg, M. & Reiss, J.D. (2012). "Digital dynamic range compressor design — a tutorial and analysis." _JAES_, 60(6).
* Zölzer, U. (ed., 2011). _DAFX — Digital Audio Effects_ (2nd ed.), chapter on dynamics processing.
* Reiss, J.D. & McPherson, A. (2014). _Audio Effects — Theory, Implementation and Application_, Ch. 6.
* Bristow-Johnson, R. (2005). "Audio EQ Cookbook." (RBJ biquad formulae, used in deesser sidechain.)
* SoX manual — `compand` (piecewise-linear compander semantics).


<div align="center">

[MIT](https://github.com/audiojs/dynamics-processor/blob/main/LICENSE) [ॐ](https://github.com/krishnized/license)

</div>
