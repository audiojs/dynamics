## @audio/dynamics [![test](https://github.com/audiojs/dynamics/actions/workflows/test.yml/badge.svg)](https://github.com/audiojs/dynamics/actions/workflows/test.yml) [![npm](https://img.shields.io/npm/v/@audio/dynamics)](https://www.npmjs.com/package/@audio/dynamics) [![license](https://img.shields.io/badge/license-MIT-green.svg)](https://github.com/audiojs/dynamics/blob/main/LICENSE)

Try it in the browser: [Loudness meter and normalizer](https://audiojs.dev/util/loudness/). Runs on this package, nothing is uploaded.

Dynamics processing — compressor, limiter, gate, expander, de-limiter, de-esser, ducker, softclip, compand, multiband. The family includes envelope-driven gain control, lookahead limiting, waveshaping and whole-buffer level correction. Part of [audiojs](https://github.com/audiojs).

| | Kind | Gain function | Typical use |
|---|---|---|---|
| [compressor](#compressor) | envelope | soft-knee above threshold | leveling vocals, mix glue |
| [limiter](#limiter) | lookahead | brickwall at ceiling | master bus, peak control |
| [gate](#gate) | envelope | hard cut below threshold | silence between phrases |
| [expander](#expander) | envelope | gentle below-threshold reduction | soft gating, noise bed shaping |
| [unlimit](#unlimit) | dual envelope | transient-gated upward expansion | de-limiting, crest restoration |
| [deesser](#deesser) | sidechain | sibilance band over voice body, cut within a range | harsh 's' in voice |
| [ducker](#ducker) | ext. sidechain | compressor keyed by side signal | music-under-voice, podcast |
| [softclip](#softclip) | waveshaper | static transfer curve | gentle peak limiting + coloration |
| [compand](#compand) | envelope | piecewise-linear transfer | SoX-style multi-segment |
| [multiband](#multiband) | envelope × N bands | LR split + per-band up/down compression | mastering glue, OTT-style upward+downward |


## Usage

```
npm install @audio/dynamics
```

```js
import { compressor, limiter } from '@audio/dynamics'

const sampleRate = 48000
const samples = Float32Array.from({ length: 4800 }, (_, i) =>
  0.8 * Math.sin(2 * Math.PI * 220 * i / sampleRate))
const opts = { sampleRate, threshold: -18, ratio: 4, attack: 5, release: 100 }
const compressed = compressor(samples, opts)
const limited = limiter(compressed, { sampleRate, ceiling: -1, lookahead: 5 })
console.log(limited.length) // 4800; samples and compressed are preserved

// Each writer owns its history. Keep it for successive chunks, then flush once.
const write = compressor(opts)
const blocks = [write(samples.subarray(0, 256)), write(samples.subarray(256)), write()]
console.log(blocks.reduce((n, block) => n + block.length, 0)) // 4800
```

For one processor: `npm install @audio/dynamics-compressor`, then `import compressor from '@audio/dynamics-compressor'`. The umbrella re-exports the same functions and types. Existing `CompressorOpts`, `GateOpts` and other legacy option names remain available alongside the leaf names (`CompressorOptions`, `GateOptions`, etc.).

### Processing expectations

| Functions | Buffer ownership / streaming | Sample-rate option |
|---|---|---|
| `compressor`, `limiter`, `gate`, `expander`, `unlimit`, `deesser`, `ducker`, `compand`, `opto`, `fet`, `vca`, `varimu` | Batch calls return a new buffer. Calling with options returns a writer; keep it across chunks and call with no arguments to flush. | `sampleRate` |
| `softclip` | Returns a new buffer. Its writer buffers until flush when `oversample > 1`. | `fs` |
| `transientShaper` | Mutates and returns the input. Reuse the same options object across chunks; a fresh object resets the envelopes. | `fs` |
| `multiband`, `leveler` | Mutate and return the input. Whole-buffer processing; no writer form. | `fs` |
| `envelope` | Returns a stateful sample → level function. Create another follower to reset. | `sampleRate` |

PCM is mono `Float32Array`; process channels with separate state/writers. Sample rate defaults to 44100 Hz. Gains/thresholds are dB and attack/release/lookahead are milliseconds unless stated otherwise: `softclip.drive` and transient-shaper gains are linear, while `leveler.frame` is seconds. Do not substitute `fs` for `sampleRate` indiscriminately; only some processors accept that alias.

Batch compression and a fresh writer fed the same signal produce the same samples. Lookahead writers can return fewer samples until flush; concatenate every returned block, including the final flush. An empty chunk is a zero-length write, not a flush. Treat flush as the end of a signal and create a new writer to reset. Options are construction settings, not a live automation interface.

The leaf `/audio` exports are host processor factories with their own parameter metadata. Some controls restart their processor, and some factories require a whole render (`streaming: false`); check those limits before using an AudioWorklet adapter.


## envelope

The common detector for the envelope-driven processors is a branching one-pole follower with separate attack/release time constants, peak or RMS detection.

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
| `truePeak` | `false` | hold the reconstructed waveform under the ceiling, not only its samples (ITU-R BS.1770 Annex 2): each interval read at 8 points through a 96-tap Kaiser sinc; 96 samples more delay |
| `detector` | `'peak'` | `'peak'` or `'rms'` |
| `rmsWindow` | `256` | samples, for RMS detector |


## compressor

Feed-forward soft-knee downward compressor, as Giannoulis, Massberg & Reiss recommend: level in dB → quadratic soft-knee gain curve → gain reduction smoothed in the log domain by the smooth decoupled peak detector → linear gain applied to input. `attack` and `release` are the time constants of the gain reduction itself (1 − 1/e), at any depth of compression; the first sample over the threshold is already reduced.

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

Lookahead brickwall limiter. The gain each sample needs, its sliding minimum over the lookahead span and that minimum's moving average: the gain ramps down across `lookahead` ms into a peak, never stepping, and still covers every sample in transit; exponential release after it passes.

```js
import { limiter } from '@audio/dynamics'

limiter(data, { ceiling: -0.3 })
limiter(data, { ceiling: -1, lookahead: 10, release: 100 })
limiter(data, { ceiling: -1, truePeak: true })   // dBTP: the waveform between samples too
```

| Param | Default | |
|---|---|---|
| `ceiling` | `-0.3` | dB (brickwall) |
| `lookahead` | `5` | ms (introduces delay) |
| `release` | `50` | ms |
| `truePeak` | `false` | hold the reconstructed waveform under the ceiling, not only its samples (ITU-R BS.1770 Annex 2): each interval read at 8 points through a 96-tap Kaiser sinc; 96 samples more delay |

**Use when:** peak control at the master bus; `truePeak` for a delivery spec in dBTP (streaming's -1 dBTP, EBU R128's -1), where a DAC or a lossy decoder rebuilds peaks up to 3 dB over the samples. Full-band noise limited 20 dB stays within 0.005 dB of the ceiling, band-limited, with 16 samples of lookahead or more.<br>
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
| `truePeak` | `false` | hold the reconstructed waveform under the ceiling, not only its samples (ITU-R BS.1770 Annex 2): each interval read at 8 points through a 96-tap Kaiser sinc; 96 samples more delay |

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

Sibilance reduction. An 's' is told by its shape, not its level: the band where sibilance lies (over `split`) is measured against the voice body (its formants, under 3.5 kHz), in dB, as the dbx 902 compares its high band with the full band. The same 's' is caught on a quiet recording and a loud one, and a cymbal in a mix, which sits over the mix's body, is left alone. How far the band rises over `threshold` sets the cut, held within `range`, the Range of the dbx 902, FabFilter Pro-DS and Waves Sibilance. A pause is measured against the voice's running level, so hiss between words is not taken for an 's'. The sound is read `lookahead` ms ahead of what is cut (a declared latency, so a host aligns it): an 's' sets its level within a few ms, and a cut that waits for it leaves its onset whole. `mode` applies the cut: **split** (default) to the band over `split` alone, x − (1 − g)·HP(x) with HP linear-phase (±1.5 ms), so x − HP is exactly the rest: no band is lifted at the split, and with no 's' the input passes sample for sample; **band** to a linear-phase band at `fc`, `Q` wide; **broadband** to the whole sound.

```js
import { deesser } from '@audio/dynamics'

deesser(data)                                    // at any recording level; aligned (a stream is `lookahead` late)
deesser(data, { mode: 'band', fc: 7500, Q: 1 })  // only that band moves
deesser(data, { threshold: 3, range: -6 })       // fewer esses, shallower
```

| Param | Default | |
|---|---|---|
| `mode` | `'split'` | `'split'` \| `'band'` \| `'broadband'` |
| `split` | `3500` | Hz, where the cut band starts in split and broadband modes, and the band watched |
| `fc` | `6500` | Hz, band mode: the band's centre (`freq` still accepted) |
| `Q` | `1.4` | band mode: its width, as a peaking EQ's (`q` still accepted) |
| `threshold` | `0` | dB of the sibilance band over the voice body where the cut starts; not a level |
| `ratio` | `4` | |
| `range` | `-8` | dB, the deepest cut |
| `knee` | `6` | dB |
| `attack` | `1` | ms |
| `release` | `15` | ms |
| `lookahead` | `5` | ms, the output's delay in a stream (never under 1.5) |

Against iZotope RX 12 De-ess, `node bench/rx/deess.mjs` in [audio](https://github.com/audiojs/audio) (2026-10): VoiceBank test speech (2 speakers) and ten Spoken Wikipedia narrations, 21.4 min; its sibilants (active frames with half their energy over 3.5 kHz, found on the clean speech), 1702 of them, made harsh by their 4–10 kHz band alone, 4–12 dB up; the clean speech the target. Every setting chosen on 28 other speakers and ten other narrations, by SNR to the clean speech; RX tuned: Classic, threshold −9, Fast, cutoff 4 kHz (defaults: −12, 2.5 kHz). Over the sibilants, the error to the clean speech taken away and their 4–10 kHz band left over the clean's (median); over the reels, SNR to the clean speech; and the clean speech through it: SNR to itself, the share of its other active frames (vowels, voiced consonants) moved by over 1 dB, its own sibilants' 4–10 kHz cut (median):

| | harsh: error taken away | harsh: 4–10 kHz left | harsh: SNR to clean | clean: SNR to input | clean: others moved | clean: own sibilants cut |
|---|---:|---:|---:|---:|---:|---:|
| RX 12 defaults | 9.5 dB | −2.0 dB | 22.5 dB | 18.7 dB | 8.1 % | 8.2 dB |
| RX 12 tuned | 12.1 dB | 0.4 dB | 25.4 dB | 20.4 dB | 4.2 % | 5.6 dB |
| 0.3.0 (broadband) | 8.9 dB | 3.4 dB | 21.9 dB | 22.7 dB | 1.1 % | 1.3 dB |
| 0.3.0, band | 5.0 dB | 4.1 dB | 18.7 dB | 24.4 dB | 0.8 % | 1.2 dB |
| **0.4.0 (split)** | **12.5 dB** | 1.4 dB | **26.2 dB** | 21.0 dB | 1.9 % | 3.9 dB |
| 0.4.0, band | 7.5 dB | 3.1 dB | 21.2 dB | 23.2 dB | 0.9 % | 2.0 dB |
| 0.4.0, broadband | 11.5 dB | 1.3 dB | 23.9 dB | 20.6 dB | 2.3 % | 4.0 dB |

0.3.0 cut late (with no look-ahead an 's' sets the level its own cut answers, so its first ms pass), on the whole sound or on a bell at `fc`, and no deeper than 6 dB, under the 4–12 dB a harsh 's' carries. `node scripts/deesser.js` runs it over speech, singing and music and reads, per 10 ms frame, how far the 4–10 kHz band and the 0.3–4 kHz voice body moved: on 's' frames (active, half their energy above 3.5 kHz) the cut, elsewhere the share of frames moved by more than 1 dB. VoiceBank test set (824 utterances), 10 narrations (60 s each), VocalSet:

| | 's' frames, 4–10 kHz cut: median · 90th pct · most | voice frames moved > 1 dB | pauses moved > 1 dB |
|---|---:|---:|---:|
| VoiceBank test, split | 3.4 · 6.6 · 8.0 dB | 2.4% | 0.7% |
| narrations, split | 4.5 · 8.0 · 8.0 dB | 2.4% | 0.9% |
| sung, split | 5.4 · 8.0 · 8.0 dB | 0.5% | 2.4% |
| VoiceBank test, band | 1.7 · 4.7 · 7.7 dB | 1.2% | 0.4% |
| narrations, band | 2.4 · 5.6 · 8.0 dB | 1.2% | 0.4% |
| sung, band | 3.4 · 6.3 · 7.4 dB | 0.4% | 1.7% |

Music ("Vibe Ace", Brahms, the Nutcracker, a trumpet): no frame moved by 1 dB in either mode. A ride cymbal 18, 12 and 6 dB under "Vibe Ace", the mix at −16 LUFS, its 4–10 kHz band cut: split, a median 0 dB (90th percentile 0, 1.1 and 4.4 dB); band, 0 dB (0, 0.8, 3.0). `{ mode: 'band', fc: 7500, Q: 1 }`: 1.7 · 5.7 · 8.0 dB on the VoiceBank test set, 1.2 %.

**Use when:** harsh 's' / 'sh' in a voice, bright vocal takes; `mode: 'band'` for a lighter hand on one band.<br>
**Not for:** broadband brightness: use an EQ. Generic compression: use [compressor](#compressor). A path that cannot wait 5 ms: `lookahead: 0` (1.5 ms, the split's own).


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


## Additional processors

| Export | Behavior and detailed options |
|---|---|
| `transientShaper` | [Attack/sustain gain shaping](https://github.com/audiojs/dynamics/blob/main/packages/dynamics-transient-shaper/README.md); state continues on the reused options object. |
| `opto` | [Optical-style compression](https://github.com/audiojs/dynamics/blob/main/packages/dynamics-opto/README.md), RMS detection and program-dependent release. |
| `fet` | [FET-style compression](https://github.com/audiojs/dynamics/blob/main/packages/dynamics-fet/README.md), fast peak detection. |
| `vca` | [VCA-style compression](https://github.com/audiojs/dynamics/blob/main/packages/dynamics-vca/README.md), feed-forward peak detection and a firm knee. |
| `varimu` | [Variable-mu-style compression](https://github.com/audiojs/dynamics/blob/main/packages/dynamics-varimu/README.md), level-dependent ratio. |
| `leveler` | [Dialogue gain riding](https://github.com/audiojs/dynamics/blob/main/packages/dynamics-leveler/README.md), whole-buffer analysis and smoothing. |

These compressor models describe gain-control behavior; they do not model a hardware unit's full circuit or coloration.

The umbrella also exposes pure dB gain-curve helpers: `compressorGain(levelDb, threshold, ratio, kneeDb)`, `upwardGain(levelDb, threshold, ratio, kneeDb, rangeDb?)`, `upwardExpanderGain(levelDb, threshold, ratio, kneeDb, rangeDb)`, and `unlimitGain(fastDb, slowDb, amount, drive)`. They return gain in dB and do not modify audio. See the corresponding leaf declarations for parameter details.

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
* dbx Professional Products (1996). _902 de-Esser owner's manual_ (18-2015-B): sibilance detected in dB of the high band against the full band, "regardless of variations in signal levels"; Range 0–20 dB, past its normal region an 's' is "swallowed".
* Sonnox. _Oxford SuprEsser user guide_, §3.3.2: auto threshold that follows the signal outside the band, with a 24 dB window.
* FabFilter. _Pro-DS help_: Threshold, Range ("scales the detected gain reduction so that it stays within a desired range"), Wide Band / Split Band. Waves. _Sibilance user guide_: Range 0 to −48 dB.
* SoX manual — `compand` (piecewise-linear compander semantics).


<div align="center">

[MIT](https://github.com/audiojs/dynamics/blob/main/LICENSE) [ॐ](https://github.com/krishnized/license)

</div>
