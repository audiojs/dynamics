## @audio/dynamics [![test](https://github.com/audiojs/dynamics/actions/workflows/test.yml/badge.svg)](https://github.com/audiojs/dynamics/actions/workflows/test.yml) [![npm](https://img.shields.io/npm/v/@audio/dynamics)](https://npmjs.org/dynamics-processor) [![license](https://img.shields.io/badge/license-MIT-green.svg)](https://github.com/audiojs/dynamics/blob/main/LICENSE)

Dynamics processing — compressor, limiter, gate, expander, de-limiter, de-esser, ducker, softclip, compand, multiband. All built on a single branching envelope follower; differences are purely in the gain curve (multiband composes N compressors across an LR crossover). Part of [audiojs](https://github.com/audiojs).

| | Kind | Gain function | Typical use |
|---|---|---|---|
| [compressor](#compressor) | envelope | soft-knee above threshold | leveling vocals, mix glue |
| [limiter](#limiter) | lookahead | brickwall at ceiling | master bus, peak control |
| [gate](#gate) | envelope | hard cut below threshold | silence between phrases |
| [expander](#expander) | envelope | gentle below-threshold reduction | soft gating, noise bed shaping |
| [unlimit](#unlimit) | dual envelope | transient-gated upward expansion | de-limiting, crest restoration |
| [deesser](#deesser) | sidechain | compressor on sibilance band | harsh 's' / 't' in voice |
| [ducker](#ducker) | ext. sidechain | compressor keyed by side signal | music-under-voice, podcast |
| [softclip](#softclip) | waveshaper | static transfer curve | gentle peak limiting + coloration |
| [compand](#compand) | envelope | piecewise-linear transfer | SoX-style multi-segment |
| [multiband](#multiband) | envelope × N bands | LR split + per-band up/down compression | mastering glue, OTT-style upward+downward |


## Usage

```
npm install @audio/dynamics
```

```js
import { compressor, limiter, gate, ducker } from '@audio/dynamics'

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
import { envelope } from '@audio/dynamics'

let follow = envelope({ attack: 5, release: 100, detector: 'peak' })
let level = []
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

Downward compression (above threshold, reduces gain) is one half of the canonical four-quadrant dynamics taxonomy — downward/upward compression, downward/upward expansion (Giannoulis, Massberg & Reiss 2012; Izhaki, *Mixing Audio*). Setting `upThreshold` engages the other compression half: **upward compression** lifts quiet passages *toward* the threshold instead of squashing loud ones — the "OTT up" half popularized by Xfer OTT. Both curves read the same envelope and sum in the dB domain, so a single compressor call can glue loud material down and lift quiet material up at once.

```js
import { compressor } from '@audio/dynamics'

compressor(data, { threshold: -18, ratio: 4 })
compressor(data, { threshold: -24, ratio: 2, knee: 12, attack: 10, release: 200, makeup: 6 })

// upward + downward together (OTT-style): lift quiet passages, squash loud ones
compressor(data, { threshold: -18, ratio: 4, upThreshold: -40, upRatio: 2, upRange: 12 })
```

| Param | Default | |
|---|---|---|
| `threshold` | `-20` | dB |
| `ratio` | `4` | — |
| `knee` | `6` | dB (soft-knee width) |
| `attack` | `5` | ms |
| `release` | `100` | ms |
| `makeup` | `0` | dB |
| `depth` | `1` | scales the summed up+down gain before makeup (OTT "Depth" macro; `0` = identity) |
| `upThreshold` | `null` | dB; `null` disables upward compression |
| `upRatio` | `2` | — (`1` is a mathematical no-op) |
| `upKnee` | `6` | dB |
| `upRange` | `12` | dB, max upward lift — without a ceiling, silence would take unbounded gain |

**Use when:** vocals, bass, drum bus, mix glue; add `upThreshold` for OTT-style up+down "aggressive" glue.<br>
**Not for:** peak control at the master bus — use [limiter](#limiter). Transparent loudness shaping — use [compand](#compand) with gentle slope.


## limiter

Lookahead brickwall limiter. A sliding-window maximum over the lookahead span drives the envelope, so gain reduction always covers every sample in transit — instant attack `lookahead` ms before a peak emerges, exponential release after it passes.

```js
import { limiter } from '@audio/dynamics'

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


## expander

Downward expander (`mode: 'downward'`, default) — a softer gate. Below threshold, gain is reduced by `(threshold − level) × (ratio − 1)` dB, clamped at `range`.

`mode: 'upward'` switches to **upward expansion** — the de-compression complement, raising gain *above* threshold instead of cutting it below. Classical substrate for de-limiting: transient-aware upward expansion restores crest factor a brickwall limiter (or an over-eager mix bus compressor) flattened. Same four-quadrant taxonomy as [compressor](#compressor)'s upward mode (Giannoulis/Reiss; Izhaki, *Mixing Audio*).

```js
import { expander } from '@audio/dynamics'

expander(data, { threshold: -30, ratio: 2 })

// de-limiting: expand transients back out above threshold
expander(data, { mode: 'upward', threshold: -20, ratio: 1.5, range: 20 })
```

| Param | Default | |
|---|---|---|
| `mode` | `'downward'` | `'downward'` \| `'upward'` |
| `threshold` | `-30` | dB |
| `ratio` | `2` | — |
| `knee` | `6` | dB |
| `range` | `-40` (downward) / `20` (upward) | dB, max reduction (downward, negative) or max lift (upward, positive) |
| `attack` | `5` | ms |
| `release` | `50` | ms |

**Use when:** gentle noise-floor suppression without the abruptness of a gate (`downward`); restoring dynamics to over-compressed or over-limited material (`upward`).<br>
**Not for:** hard removal of sound between phrases — use [gate](#gate).


## unlimit

De-limiter. iZotope Ozone 12's "Unlimiter" (Sept 2025) created the de-limiting category with a trained ML model; this atom is the **classical counterpart** — transient-synchronous upward expansion, restoring the crest factor a brickwall limiter (or an over-eager bus compressor) flattened. Program-adaptive upward expansion gated to transients, not level — one more cell in the four-quadrant dynamics taxonomy (Giannoulis, Massberg & Reiss 2012, JAES 60(6); Izhaki, *Mixing Audio*), built on [expander](#expander)'s `upwardExpanderGain` curve.

A fast envelope (`fastAttack`/`fastRelease`, near-instant) and a slow envelope (`slowAttack`/`slowRelease`, sluggish) both track the input; their gap in dB — *transientness* — rises sharply on attacks and sits near zero on sustained material. Gain lift follows transientness, not absolute level: an absolute-level upward expander would pump sustains; gating on the fast/slow gap instead is what makes this a de-limiter rather than a leveler.

```js
import { unlimit } from '@audio/dynamics'

unlimit(data, { amount: 9, drive: 2 })                  // deliberate restoration
unlimit(data, { amount: 9, drive: 2, ceiling: -1 })      // guard restored peaks at -1 dBFS
```

| Param | Default | |
|---|---|---|
| `amount` | `6` | dB, max crest restoration (range 0–18) |
| `drive` | `1` | scales the deficit-driven restoration (1 = restore attacks to `crestTarget`); in `adaptive: false` mode, dB of lift per dB of transientness |
| `adaptive` | `true` | deficit mode (see below); `false` = raw proportional transient-following (a transient exaggerator, for manual sound design) |
| `crestTarget` | `10` | dB of transientness a healthy attack is expected to show; flattened attacks get lifted by what they're missing |
| `ceiling` | `null` | dBFS; post guard so restored peaks don't exceed it. `null` (default): peaks may exceed 0 dBFS by design (float domain) |
| `fastAttack` | `0.5` | ms |
| `fastRelease` | `20` | ms |
| `slowAttack` | `20` | ms |
| `slowRelease` | `200` | ms |

The default mode lifts by transient **deficit**, not transient presence — the inverse-limiter insight: a brickwall limiter's fingerprint is attacks that are too *small* (3–8 dB of fast-over-slow transientness where healthy program shows 12–25 dB), so each onset gets back `crestTarget − measured` dB, and a naturally healthy attack gets structurally **zero** lift. Safety on dynamic material is a property of the curve, not a timid default: measured on the test fixture, defaults change never-limited program by ≤ 0.2 dB RMS while `amount: 9` recovers ~4.5 dB of crest from a 9 dB-crushed brickwall (see tests). Three gates make that separation robust — peak-hold (deficit is judged against an attack's *peak* transientness, not its rise samples), a 10 ms attack window (a decaying tail keeps the fast envelope above the slow one for its whole length; a decay is not an onset), and a ~3 ms confirmation ramp (a healthy attack outruns `crestTarget` in ~1.5 ms, collapsing its own deficit before lift confirms; a limiter-flattened plateau is still standing).

**Honest scope:** this restores dynamics/crest — it cannot recover information a clipper already destroyed (pair with [`@audio/denoise-declip`](https://github.com/audiojs/denoise) for that), and it does not un-mix limiter pumping artifacts baked into the waveform's history. Over-driving `amount`/`drive` invents transients that were never there. v1 is zero-latency with no lookahead — it reacts to a transient already underway, it cannot anticipate one; lookahead attack-anticipation is a future option.

**Use when:** restoring life to over-limited masters, streaming-loudness-flattened stems, squashed dialogue or game audio.<br>
**Not for:** recovering clipped/distorted peaks — use a declipper. Undoing audible limiter pumping — remix from an earlier, unlimited stage if one exists.


## deesser

Sibilance reduction, two architectures behind `mode`: **broadband** (default) — a biquad bandpass drives the envelope follower and the gain reduction is applied broadband; simple and transparent. **band** — an HP-filtered sidechain drives a dynamic peaking EQ at `freq`, so only the sibilance band is cut and program below it stays untouched even during deep reduction (wideband/split-band precedent).

```js
import { deesser } from '@audio/dynamics'

deesser(data, { freq: 6500, threshold: -20 })
deesser(data, { freq: 5500, q: 3, threshold: -24, ratio: 6 })
deesser(data, { mode: 'band', freq: 7000, threshold: -30, ratio: 8 })
```

| Param | Default | |
|---|---|---|
| `mode` | `'broadband'` | `'broadband'` \| `'band'` |
| `freq` | `6500` | Hz, sibilance center |
| `q` | `2` | bandpass Q (broadband) / `1.4` peaking-cut Q (band) |
| `threshold` | `-20` | dB (on sidechain level) |
| `ratio` | `4` | — |
| `knee` | `6` | dB (broadband only) |
| `attack` | `1` | ms |
| `release` | `40` | ms |

**Use when:** harsh 's' / 't' / 'sh' in close-miked voice, bright vocal takes; `mode: 'band'` when the voice sits with program that must not pump.<br>
**Not for:** broadband brightness — use an EQ. Generic compression — use [compressor](#compressor).


## ducker

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


## softclip

Static waveshaping — no time state, no pumping. Maps input through a fixed transfer curve; peaks saturate smoothly, introducing controlled harmonic content.

Hard/high-drive clipping generates harmonics above Nyquist that fold back as audible aliasing. `oversample` (1/2/4/8, default `1`) runs the transfer at N× rate and decimates back down through a windowed-sinc anti-alias filter, same technique as [`@audio/saturate`](https://github.com/audiojs/saturate)'s oversampled shapers — `oversample: 1` is the exact non-oversampled path (no resampling, zero cost).

```js
import { softclip } from '@audio/dynamics'

softclip(data, { curve: 'tanh', drive: 1.5 })
softclip(data, { curve: 'cubic', drive: 2, ceiling: 0.9 })
softclip(data, { curve: 'hard', drive: 4, oversample: 4, fs: 44100 })   // clean high-drive clip
```

| Param | Default | |
|---|---|---|
| `curve` | `'tanh'` | `'tanh'`, `'atan'`, `'cubic'`, `'sin'`, `'hard'` |
| `drive` | `1` | input pre-gain |
| `ceiling` | `1` | output asymptote |
| `oversample` | `1` | `1`, `2`, `4`, `8` — anti-aliased oversampling |
| `fs` | `44100` | Hz, sample rate (only used when `oversample > 1`) |

**Use when:** gentle peak control with musical saturation, avoiding pumping artifacts of a limiter, lo-fi character; `oversample` for hard/high-drive clipping that must stay alias-free.<br>
**Not for:** transparent true-peak safety — use [limiter](#limiter). Clean gain reduction — use [compressor](#compressor).


## compand

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


## multiband

Multiband compressor — Linkwitz-Riley crossover split, an independent [compressor](#compressor) per band (upward half included), flat sum by construction (SoX `mcompand` class). The manifest (`multiband/audio`) is a 3-band "one-knob" mastering stage — one shared setting across low/mid/high, split at `low`/`high`. The kernel (`multiband(data, opts)`) takes N-1 crossover points and per-band settings directly, for full control; every `bands` entry is spread straight into `compressor()`, so upward compression and `depth` are already there per band.

```js
import { multiband } from '@audio/dynamics'

// one-knob: shared setting across 3 bands split at 200/2000 Hz
multiband(data, { freqs: [200, 2000], bands: { threshold: -24, ratio: 3 } })

// per-band settings, N bands (mutates data in place)
multiband(data, {
  freqs: [400, 4000],
  bands: [
    { threshold: -24, ratio: 3 },               // low
    { threshold: -20, ratio: 4, makeup: 2 },     // mid
    null,                                        // high: pass through uncompressed
  ],
})
```

**OTT-class upward+downward multiband** — [Xfer OTT](https://xferrecords.com/products/ott)'s "upward + downward compression on 3 bands" recipe, reproduced with this atom's `upThreshold`/`upRatio`/`depth`:

```js
let depth = 1   // OTT's "Depth" macro — 0 is a transparent pass, 1 is full effect, up to 2 overshoots it
multiband(data, {
  freqs: [88.3, 2500],   // OTT's own crossover points
  bands: [
    { threshold: -24, ratio: 4, upThreshold: -30, upRatio: 2, attack: 2, release: 35, depth },  // low
    { threshold: -24, ratio: 4, upThreshold: -30, upRatio: 2, attack: 5, release: 60, depth },  // mid
    { threshold: -24, ratio: 4, upThreshold: -30, upRatio: 2, attack: 2, release: 35, depth },  // high
  ],
})
```

| Param | Default | |
|---|---|---|
| `freqs` | `[200, 2000]` | Hz, N-1 crossover points for N bands |
| `bands` | — | per-band `{threshold, ratio, knee, attack, release, makeup, upThreshold, upRatio, upKnee, upRange, depth}`, or one object shared by all bands; `null` passes a band through uncompressed |
| `order` | `4` | Linkwitz-Riley crossover order (2, 4, 8) |
| `fs` | `44100` | Hz |

Manifest params (3-band one-knob form): `low`, `high`, `threshold`, `ratio`, `upThreshold`, `upRatio`, `depth`, `attack`, `release`, `makeup`.

**Use when:** mastering-stage glue across the spectrum; OTT-style "upward + downward everywhere" aggressive multiband; taming one band without touching others.<br>
**Not for:** single-band dynamics — use [compressor](#compressor) directly.


## See also

* [denoise](https://github.com/audiojs/denoise) — umbrella for everything noise; its `gate`/`deesser` are seconds-unit adapters over this package (2026-07 near-dupe merge)
* [filter](https://github.com/audiojs/filter) — biquads for deesser sidechain
* [effect](https://github.com/audiojs/effect) — modulation effects
* [stretch](https://github.com/audiojs/stretch) — sibling package


## References

* Giannoulis, D., Massberg, M. & Reiss, J.D. (2012). "Digital dynamic range compressor design — a tutorial and analysis." _JAES_, 60(6).
* Izhaki, R. _Mixing Audio: Concepts, Practices and Tools._ Focal Press / Routledge. Four-quadrant dynamics taxonomy — downward/upward compression, downward/upward expansion.
* Zölzer, U. (ed., 2011). _DAFX — Digital Audio Effects_ (2nd ed.), chapter on dynamics processing.
* Reiss, J.D. & McPherson, A. (2014). _Audio Effects — Theory, Implementation and Application_, Ch. 6.
* Bristow-Johnson, R. (2005). "Audio EQ Cookbook." (RBJ biquad formulae, used in deesser sidechain.)
* SoX manual — `compand` (piecewise-linear compander semantics).


<div align="center">

[MIT](https://github.com/audiojs/dynamics/blob/main/LICENSE) [ॐ](https://github.com/krishnized/license)

</div>
