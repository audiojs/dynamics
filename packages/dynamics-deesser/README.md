# @audio/dynamics-deesser [![npm](https://img.shields.io/npm/v/@audio/dynamics-deesser)](https://www.npmjs.com/package/@audio/dynamics-deesser) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

De-esser: the sibilance band's level over the voice body's drives a cut held within a range, read 5 ms ahead, on the band over 3.5 kHz (linear phase), a band, or broadband; the same at any recording level

```
npm install @audio/dynamics-deesser
```

```js
import deesser from '@audio/dynamics-deesser'
```

Sibilance reduction. An 's' is told by its shape, not its level: the band where sibilance lies (over `split`) is measured against the voice body (its formants, under 3.5 kHz), in dB, as the dbx 902 compares its high band with the full band. The same 's' is caught on a quiet recording and a loud one, and a cymbal in a mix, which sits over the mix's body, is left alone. How far the band rises over `threshold` sets the cut, held within `range`, the Range of the dbx 902, FabFilter Pro-DS and Waves Sibilance. A pause is measured against the voice's running level, so hiss between words is not taken for an 's'. The sound is read `lookahead` ms ahead of what is cut (a declared latency, so a host aligns it): an 's' sets its level within a few ms, and a cut that waits for it leaves its onset whole. `mode` applies the cut: **split** (default) to the band over `split` alone, x − (1 − g)·HP(x) with HP linear-phase (±1.5 ms), so x − HP is exactly the rest: no band is lifted at the split, and with no 's' the input passes sample for sample; **band** to a linear-phase band at `fc`, `Q` wide; **broadband** to the whole sound.

```js
import deesser from '@audio/dynamics-deesser'

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

---

Part of [@audio/dynamics](https://github.com/audiojs/dynamics) — the dynamics family umbrella. This README is generated from the umbrella docs.

MIT © [audiojs](https://github.com/audiojs)
