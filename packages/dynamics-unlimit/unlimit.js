import { envelope } from '@audio/dynamics-envelope'
import { upwardExpanderGain } from '@audio/dynamics-expander'
import { writer, concat, db2lin, lin2db } from './util.js'

// De-limiter — the classical, non-ML counterpart to iZotope Ozone 12's "Unlimiter"
// (Sept 2025), which introduced de-limiting as a category via a trained model. This
// atom does the same job with a transparent, inspectable recipe: transient-synchronous
// upward expansion, restoring the crest factor a brickwall limiter (or an over-eager
// bus compressor) flattened. Program-adaptive upward expansion gated to transients —
// one more cell in the four-quadrant dynamics taxonomy (Giannoulis, Massberg & Reiss
// 2012, JAES 60(6); Izhaki, Mixing Audio).
//
// Detector: a fast envelope (near-instant) and a slow envelope (sluggish), both
// @audio/dynamics-envelope, both tracking the same input. Their gap in dB —
// "transientness" — is ~0 on sustained material AND on heavily-limited program
// (limiting flattens the fast/slow gap at former transients; that flatness is
// exactly what gets re-expanded from the residual micro-transients that survive
// limiting), and rises sharply on attacks. Gain lift follows transientness, not
// absolute level: an absolute-level upward expander would pump sustains; gating on
// transientness — not level — is what makes this a de-limiter and not a leveler.
//
// Curve: unlimitGain reuses upwardExpanderGain (@audio/dynamics-expander) as its
// gain-shape substrate rather than a hand-rolled min()/clamp — same soft-knee
// quadratic, with `threshold` pinned to KNEE/2 so the knee's lower half lands
// exactly at zero transientness (transientness can't go negative — max(0, ·) — so
// a knee centered on 0 like a normal expander's would waste its bottom half and,
// worse, leave a nonzero residual lift right at rest). The result: r(0) = 0 exactly,
// a quadratic soft launch through [0, KNEE], then a `drive` dB/dB linear slope
// beyond — no lift at all on sustained material, no hard corner at the resting state.
//
// Deficit mode (`adaptive`, default on) — the inverse-limiter insight: transientness
// alone cannot separate a limited attack from a natural one by its PRESENCE (any hard
// onset drives the fast envelope over the slow one), but it separates them perfectly
// by its SIZE — a brickwall limiter's fingerprint is attacks that are too small
// (3–8 dB of fast-over-slow where healthy program shows 12–25 dB). So the default
// mode lifts each onset by its transient DEFICIT: max(0, crestTarget − transientness),
// gated by onset presence (no onset → nothing to restore, however large the "deficit").
// Natural attacks at/above crestTarget get structurally ZERO lift — safety on dynamic
// material is a property of the curve, not a conservative default; flattened attacks
// get back exactly the dB they are missing. `adaptive: false` = raw proportional
// transient-following (a transient exaggerator, kept for manual sound design).
//
// v1 is zero-latency, no lookahead: it reacts to a transient already in progress, it
// cannot anticipate one. Lookahead attack-anticipation is a future option.
export default function unlimit(data, opts) {
  if (!(data instanceof Float32Array)) return writer(unlimitStream(data))
  let s = unlimitStream(opts)
  return concat(s.write(data), s.flush())
}

// Soft-knee width (dB) for the launch off the zero floor — see header. Not exposed
// as a param: it shapes unlimitGain's curve, not the detector or the amount/drive
// macro controls. Wide relative to a typical compressor/expander knee (6 dB, see
// @audio/dynamics-expander) because the quantity it's softening — transientness,
// not level — spans a much bigger natural range before it means anything.
const KNEE = 60

// Onset gate for deficit mode: lift engages only while an onset is actually in
// progress — transientness ramping 0 → 1 across [ONSET_FLOOR, ONSET_FLOOR + ONSET_SOFT]
// dB. Below the floor there is no attack to restore (sustains, silence).
const ONSET_FLOOR = 1.5
const ONSET_SOFT = 3

export function unlimitStream(opts = {}) {
  let sr = opts.sampleRate || 44100
  let amount = opts.amount ?? 6
  let drive = opts.drive ?? 1
  let ceiling = opts.ceiling ?? null
  let ceilLin = ceiling == null ? Infinity : db2lin(ceiling)
  let adaptive = opts.adaptive ?? true
  let crestTarget = opts.crestTarget ?? 10

  let fastAttack = opts.fastAttack ?? 0.5
  let fastRelease = opts.fastRelease ?? 20
  let fast = envelope({ sampleRate: sr, attack: fastAttack, release: fastRelease })
  let slow = envelope({ sampleRate: sr, attack: opts.slowAttack ?? 20, release: opts.slowRelease ?? 200 })
  // Smooths the target lift with the fast envelope's own ballistics, so gain-curve
  // corners and the amount/drive clamps don't zipper sample-to-sample.
  let smooth = envelope({ sampleRate: sr, attack: fastAttack, release: fastRelease })

  // Deficit-mode gating, three pieces (each kills a distinct false-lift mode):
  // 1. Peak hold — an attack's size is its PEAK transientness, not the values its
  //    ramp transits through: hold the running max (release ~150 dB/s) and evaluate
  //    the deficit against it, so a healthy hit that shoots past crestTarget within
  //    a millisecond reads deficit-free from that moment on.
  // 2. Attack window — an attack is where transientness RISES; the long decay walking
  //    back down through the deficit range is not an onset (a decaying hit keeps the
  //    fast envelope above the slow one for its entire tail). Lift is allowed only
  //    within ~10 ms of a fresh peak; the tail is hard-gated regardless of deficit.
  // 3. Confirmation ramp (~3 ms) — keeps the rise transit itself from latching into
  //    the lift smoother: a healthy attack blows past crestTarget within ~1.5 ms
  //    (3× the fast envelope's 0.5 ms attack), collapsing its own deficit before the
  //    ramp opens; a limiter-flattened attack PLATEAUS its small transientness for
  //    the limiter's release duration (many ms), so its deficit is still standing
  //    when confirmation completes.
  // A flattened (limited) onset holds its small transientness plateau for many ms —
  // fresh peaks keep re-arming the window and the deficit stays open, so restoration
  // engages exactly there and nowhere else.
  let xHold = 0
  let holdStep = 150 / sr // dB per sample
  let confirm = 0
  let confirmStep = 1 / (0.003 * sr)
  let attackT = Infinity
  let attackWin = Math.round(0.010 * sr) // samples

  return {
    write(chunk) {
      let out = new Float32Array(chunk.length)
      for (let i = 0; i < chunk.length; i++) {
        let x = chunk[i]
        let fastDb = lin2db(fast(x))
        let slowDb = lin2db(slow(x))
        let target
        if (adaptive) {
          let t = fastDb - slowDb
          if (t < 0) t = 0
          if (t > xHold) { xHold = t; attackT = 0 }
          else { xHold = xHold - holdStep > 0 ? xHold - holdStep : 0; attackT++ }
          confirm = t > ONSET_FLOOR ? (confirm + confirmStep > 1 ? 1 : confirm + confirmStep) : 0
          target = attackT < attackWin ? confirm * unlimitDeficitGain(xHold, crestTarget, amount, drive) : 0
        } else {
          target = unlimitGain(fastDb, slowDb, amount, drive)
        }
        let liftDb = smooth(target)
        let y = x * db2lin(liftDb)
        if (ceiling != null) {
          let a = y < 0 ? -y : y
          if (a > ceilLin) y *= ceilLin / a
        }
        out[i] = y
      }
      return out
    },
    flush() { return new Float32Array(0) }
  }
}

// Pure mapping (legacy / adaptive:false): transientness (dB, fast envelope above slow)
// → target lift (dB), before ballistic smoothing. Proportional transient-following:
// amount caps total lift; drive is the dB-out-per-dB-in slope beyond the knee (see
// KNEE, above — threshold pinned to KNEE/2 so r(0) = 0). Note this mode lifts natural
// attacks as much as limited ones — it is a transient exaggerator, kept for manual work.
export function unlimitGain(fastDb, slowDb, amount, drive) {
  let x = fastDb - slowDb
  if (x < 0) x = 0
  return upwardExpanderGain(x, KNEE / 2, drive + 1, KNEE, amount)
}

// Pure mapping (default, adaptive de-limit): transient DEFICIT → lift. The inverse-
// limiter insight: a brickwall limiter's fingerprint is attacks that are too SMALL —
// so restoration lifts each onset by what it is missing relative to healthy program
// (`crestTarget` dB of transientness), gated by onset presence so sustains and
// silence (zero transientness → full "deficit", but nothing to restore) stay
// untouched. Natural attacks at/above crestTarget have zero deficit → zero lift,
// structurally — safety on dynamic material is a property of the curve, not a small
// default. Takes the transientness measure directly (the stream feeds the PEAK-HELD
// value — an attack's size is its peak, not its ramp). drive scales the restoration
// (1 = restore to target); amount caps it.
export function unlimitDeficitGain(transientnessDb, crestTarget, amount, drive) {
  let x = transientnessDb
  if (x < 0) x = 0
  let onset = (x - ONSET_FLOOR) / ONSET_SOFT
  if (onset <= 0) return 0
  if (onset > 1) onset = 1
  let deficit = crestTarget - x
  if (deficit <= 0) return 0
  let lift = deficit * drive
  return onset * (lift > amount ? amount : lift)
}
