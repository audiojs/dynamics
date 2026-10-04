# @audio/dynamics-deesser [![npm](https://img.shields.io/npm/v/@audio/dynamics-deesser)](https://www.npmjs.com/package/@audio/dynamics-deesser) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

De-esser: the sibilance band's level over the voice body's drives a cut held within a range, the same at any recording level.

```
npm install @audio/dynamics-deesser
```

```js
import deesser from '@audio/dynamics-deesser'
```

Sibilance reduction. An 's' is told by its shape, not its level: the sibilance band (a bandpass at `fc`, `Q`) is measured against the voice body (a low-pass an octave under `fc`), in dB, as the dbx 902 compares its high band with the full band. The same 's' is caught on a quiet recording and a loud one, and a cymbal in a mix, which sits over the mix's body, is left alone. How far the band rises over `threshold` sets the cut, held within `range`, the Range of the dbx 902, FabFilter Pro-DS and Waves Sibilance: past about 6 dB an 's' turns into a lisp. A pause is measured against the voice's running level, so hiss between words is not taken for an 's'. `mode` applies the cut: **broadband** (default) turns the whole sound down while the 's' lasts; **band** is a peaking EQ at `fc`, so only the sibilance band moves.

```js
import deesser from '@audio/dynamics-deesser'

deesser(data)                                    // at any recording level
deesser(data, { mode: 'band', fc: 7500, Q: 1 })  // only the sibilance band moves
deesser(data, { threshold: -3, range: -8 })      // softer esses too, deeper
```

| Param | Default | |
|---|---|---|
| `mode` | `'broadband'` | `'broadband'` \| `'band'` |
| `fc` | `6500` | Hz, sibilance center: the band watched and, in band mode, cut; the body is under `fc / 2` (`freq` still accepted) |
| `Q` | `2` | width of that band; `1.4` in band mode (`q` still accepted) |
| `threshold` | `0` | dB of the sibilance band over the voice body where the cut starts; not a level |
| `ratio` | `4` | — |
| `range` | `-6` | dB, the deepest cut |
| `knee` | `6` | dB |
| `attack` | `1` | ms |
| `release` | `15` | ms |

`node scripts/deesser.js` runs it over speech, singing and music and reads, per 10 ms frame, how far the 4–10 kHz band and the 0.3–4 kHz voice body moved: on 's' frames (active, half their energy above 3.5 kHz) the cut, elsewhere the share of frames moved by more than 1 dB. The defaults were chosen on 504 VoiceBank training utterances of 28 speakers and 10 narrations (`SET=train`); below, the VoiceBank test set (824 utterances, 2 other speakers) measured once, 10 other narrations (spoken Wikipedia, 60 s each), VocalSet:

| | 's' frames, 4–10 kHz cut: median · 90th pct · most | voice frames moved > 1 dB | pauses moved > 1 dB |
|---|---:|---:|---:|
| VoiceBank test, broadband | 0.6 · 4.4 · 6.0 dB | 1.1% | 0.2% |
| narrations, broadband | 2.1 · 6.0 · 6.0 dB | 1.2% | 0.4% |
| sung, broadband | 3.6 · 6.0 · 6.0 dB | 0.4% | 0.7% |
| VoiceBank test, band | 0.6 · 3.3 · 5.7 dB | 0.9% | 0.1% |
| narrations, band | 1.7 · 3.9 · 5.7 dB | 1.1% | 0.3% |
| sung, band | 2.6 · 4.2 · 5.1 dB | 0.4% | 0.6% |

Normalized to −16 LUFS first, as the editor's recipes do, every figure is the same. Music ("Vibe Ace", Brahms, the Nutcracker, a trumpet): no frame moved by 1 dB in either mode. A ride cymbal 18, 12 and 6 dB under "Vibe Ace", the mix at −16 LUFS: its 4–10 kHz band cut by a median 0 dB (90th percentile 0, 0 and 0.5 dB).

0.2.7 (a threshold on the band's own level, its cut unbounded) did next to nothing at its defaults on these files at their own level (the narrations sit between −41 and −11 LUFS), and too much once they were loud: at −16 LUFS with the editor's "De-ess a voice" settings (`{ mode: 'band', fc: 7500, Q: 1, threshold: -35 }`) it cut the narrations' 's' frames by a median 5.7 dB, 10.9 at the 90th percentile and up to 15.9, moved 23 % of their voice frames and 22 % of Brahms' and the trumpet's, and cut the ride 12 dB under "Vibe Ace" by a median 5.4 dB. `{ mode: 'band', fc: 7500, Q: 1 }` now: 1.5 · 4.6 · 5.6 dB, 1.0 %, none, 0 dB.

**Use when:** harsh 's' / 'sh' in a voice, bright vocal takes; `mode: 'band'` when the voice sits with program that must not pump.<br>
**Not for:** broadband brightness — use an EQ. Generic compression — use [compressor](#compressor).

---

Part of [@audio/dynamics](https://github.com/audiojs/dynamics) — the dynamics family umbrella. This README is generated from the umbrella docs.

MIT © [audiojs](https://github.com/audiojs)
