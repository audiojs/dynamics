# @audio/dynamics-unlimit [![npm](https://img.shields.io/npm/v/@audio/dynamics-unlimit)](https://www.npmjs.com/package/@audio/dynamics-unlimit) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Classical de-limiter: transient-gated upward expansion restoring crest a brickwall limiter flattened

```
npm install @audio/dynamics-unlimit
```

```js
import unlimit from '@audio/dynamics-unlimit'
```

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

---

Part of [@audio/dynamics](https://github.com/audiojs/dynamics) — the dynamics family umbrella. This README is generated from the umbrella docs.

MIT © [audiojs](https://github.com/audiojs)
