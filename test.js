import test, { almost, ok, is } from 'tst'
import { compressor, limiter, gate, expander, unlimit, deesser, ducker, softclip, compand, envelope, transientShaper, multiband, opto, fet, vca, varimu, leveler } from './index.js'
import { latency } from '@audio/dynamics-deesser'
import { latency as limiterLatency } from '@audio/dynamics-limiter'

const fs = 44100

function sine(freq, n, amp = 1) {
  let d = new Float32Array(n)
  for (let i = 0; i < n; i++) d[i] = amp * Math.sin(2 * Math.PI * freq * i / fs)
  return d
}

function rms(data) {
  let s = 0
  for (let i = 0; i < data.length; i++) s += data[i] * data[i]
  return Math.sqrt(s / data.length)
}

function peak(data) {
  let p = 0
  for (let i = 0; i < data.length; i++) { let a = Math.abs(data[i]); if (a > p) p = a }
  return p
}

const db = (lin) => 20 * Math.log10(Math.max(lin, 1e-10))


// --- envelope ---

test('envelope — tracks constant input', () => {
  let follow = envelope({ sampleRate: fs, attack: 1, release: 1 })
  let last = 0
  for (let i = 0; i < fs; i++) last = follow(0.5)
  almost(last, 0.5, 0.01)
})

test('envelope — peak and rms converge to canonical values on unit sine', () => {
  let p = envelope({ sampleRate: fs, attack: 50, release: 50, detector: 'peak' })
  let r = envelope({ sampleRate: fs, attack: 50, release: 50, detector: 'rms', rmsWindow: 256 })
  let s = sine(1000, fs, 1)
  let lp = 0, lr = 0
  for (let i = 0; i < s.length; i++) { lp = p(s[i]); lr = r(s[i]) }
  almost(lp, 2 / Math.PI, 0.02, 'smoothed |sin| → 2/π')
  almost(lr, 1 / Math.SQRT2, 0.02, 'sqrt(mean(sin²)) → 1/√2')
})


// --- compressor ---

test('compressor — reduces loud signal', () => {
  let loud = sine(1000, fs >> 1, 0.8)    // ≈ -1.9 dB, well above -20 dB threshold
  let out = compressor(loud, { threshold: -20, ratio: 4, attack: 1, release: 10 })
  is(out.length, loud.length)
  ok(peak(out) < peak(loud), 'peak reduced')
  ok(rms(out) < rms(loud), 'rms reduced')
})

test('compressor — passes quiet signal untouched', () => {
  let quiet = sine(1000, fs >> 2, 0.01)  // -40 dB, below threshold
  let out = compressor(quiet, { threshold: -20, ratio: 4 })
  almost(peak(out), peak(quiet), 0.001, 'passes')
})

test('compressor — makeup gain raises output', () => {
  let data = sine(1000, fs >> 2, 0.5)
  let noMakeup = compressor(data, { threshold: -20, ratio: 4, makeup: 0 })
  let withMakeup = compressor(data, { threshold: -20, ratio: 4, makeup: 6 })
  ok(rms(withMakeup) > rms(noMakeup), 'makeup lifts level')
})

test('compressor — hard knee (knee: 0) yields no NaN', () => {
  let data = sine(1000, fs >> 2, 0.5)
  let out = compressor(data, { threshold: -20, ratio: 4, knee: 0 })
  for (let i = 0; i < out.length; i++) if (Number.isNaN(out[i])) throw new Error(`NaN at ${i}`)
  ok(rms(out) < rms(data), 'compresses')
})

test('compressor — default envelope is attack 5 / release 100 as documented', () => {
  let data = sine(1000, fs >> 2, 0.5)
  let dflt = compressor(data, { threshold: -20, ratio: 4 })
  let expl = compressor(data, { threshold: -20, ratio: 4, attack: 5, release: 100 })
  for (let i = 0; i < dflt.length; i++)
    if (dflt[i] !== expl[i]) throw new Error(`defaults diverge at ${i}`)
  ok(true, 'identical')
})

test('compressor — streaming matches batch length', () => {
  let data = sine(1000, 4096, 0.8)
  let write = compressor({ threshold: -20, ratio: 4, attack: 1, release: 10 })
  let a = write(data.subarray(0, 2048))
  let b = write(data.subarray(2048))
  let tail = write()
  is(a.length + b.length + tail.length, data.length)
})


// Giannoulis, Massberg & Reiss, JAES 60(6), 2012: static curve eq. (4); gain reduction smoothed in the log domain
// after the gain computer, eq. (23), by the smooth decoupled peak detector, eq. (17); α = e^(−1/(τ·fs)), eq. (7).

test('compressor: settled gain is the static curve of eq. (4), through the knee', () => {
  let T = -24, R = 3, W = 6
  for (let level of [-40, -27.1, -26, -24, -22, -21, -20.9, -10, 0]) {
    let x = new Float32Array(fs).fill(10 ** (level / 20))
    let y = compressor(x, { threshold: T, ratio: R, knee: W, sampleRate: fs })
    let d = level - T, want = 2 * d < -W ? 0 : 2 * Math.abs(d) <= W ? (1 / R - 1) * (d + W / 2) ** 2 / (2 * W) : (1 / R - 1) * d
    almost(db(y[fs - 1] / x[fs - 1]), want, 1e-6, `${level} dB in: ${want.toFixed(3)} dB`)
  }
})

test('compressor: attack and release are the gain reduction\'s time constants at any depth, eq. (7)', () => {
  let T = -24, R = 3, tA = 5, tR = 100, n = fs
  for (let over of [3, 10, 20]) {
    let A = 10 ** ((T + over) / 20), x = new Float32Array(n).fill(A)
    x.fill(10 ** (-60 / 20), n / 2)
    let y = compressor(x, { threshold: T, ratio: R, knee: 0, attack: tA, release: tR, sampleRate: fs })
    let G = over * (1 - 1 / R), gr = i => -db(y[i] / x[i])
    // attack: y₁ jumps to G, y follows it by one pole: G·(1 − e^(−t/τA))
    let iA = Math.round(tA * fs / 1000)
    almost(gr(iA - 1) / G, 1 - Math.exp(-1), 1e-3, `+${over} dB: ${(100 * gr(iA - 1) / G).toFixed(1)}% of the reduction after τA`)
    // release: y₁ decays by e^(−t/τR), y follows by e^(−t/τA): G·(τR·e^(−t/τR) − τA·e^(−t/τA)) / (τR − τA)
    let iR = Math.round(tR * fs / 1000), t = tR, want = (tR * Math.exp(-t / tR) - tA * Math.exp(-t / tA)) / (tR - tA)
    almost(gr(n / 2 + iR) / G, want, 2e-3, `+${over} dB: ${(100 * gr(n / 2 + iR) / G).toFixed(1)}% left after τR`)
  }
})

test('compressor: no attack lag: the first sample over the threshold is already reduced', () => {
  let x = new Float32Array(fs / 10).fill(10 ** (-60 / 20))
  x.fill(10 ** (-4 / 20), 1000)
  let y = compressor(x, { threshold: -24, ratio: 4, knee: 0, attack: 5, sampleRate: fs })
  is(y[999], x[999], 'below threshold: untouched')
  ok(y[1000] < x[1000], `first sample over: ${db(y[1000] / x[1000]).toFixed(4)} dB`)
})

test('compressor: a steady tone settles at the static curve for its peak level', () => {
  let x = sine(1000, fs, 10 ** (-6 / 20))
  let y = compressor(x, { threshold: -24, ratio: 3, knee: 0, attack: 5, release: 100, sampleRate: fs })
  almost(db(peak(y.subarray(fs / 2)) / peak(x.subarray(fs / 2))), -12, 0.05, 'peak −6 dB, 18 over at 3:1: −12 dB')
})

// --- compressor: upward (four-quadrant taxonomy — Giannoulis, Massberg & Reiss 2012,
// JAES 60(6); Izhaki, Mixing Audio — downward/upward compression, downward/upward
// expansion. Upward is the "OTT up" half: lifts quiet passages toward the threshold.) ---

test('compressor upward — static lift', () => {
  let sr = 44100
  // RMS detector converges cleanly to 20·log10(amp/√2) — pick amp so that level = -40 dB.
  let amp = Math.SQRT2 * 10 ** (-40 / 20)
  let d = sine(1000, sr, amp)
  let out = compressor(d, { threshold: -20, ratio: 4, upThreshold: -20, upRatio: 2, upKnee: 0, upRange: 40, detector: 'rms' })
  let lift = toDb(rmsOf(out, sr / 2)) - toDb(rmsOf(d, sr / 2))
  almost(lift, 10, 0.7, `lift ${lift.toFixed(2)} dB`)   // (20)·(1 − 1/2) = 10 dB
})

test('compressor upward — above threshold untouched', () => {
  let sr = 44100
  let d = tone(-10, 0.5, 1000, sr)
  let out = compressor(d, { threshold: -18, ratio: 1, upThreshold: -20, upRatio: 3 })   // ratio: 1 neutralizes downward
  let delta = toDb(rmsOf(out, sr / 4)) - toDb(rmsOf(d, sr / 4))
  almost(delta, 0, 0.2, `untouched: ${delta.toFixed(3)} dB`)
})

test('compressor upward — range clamps', () => {
  let sr = 44100
  let amp = Math.SQRT2 * 10 ** (-60 / 20)
  let d = sine(1000, sr, amp)
  let out = compressor(d, { threshold: -20, ratio: 4, upThreshold: -20, upRatio: 4, upRange: 12, detector: 'rms' })
  let lift = toDb(rmsOf(out, sr / 2)) - toDb(rmsOf(d, sr / 2))
  almost(lift, 12, 0.7, `lift ${lift.toFixed(2)} dB (would be 30 unclamped)`)
})

test('compressor upward — upRatio 1 is a no-op (byte-exact)', () => {
  let d = sine(1000, 4096, 0.4)
  let plain = compressor(d, { threshold: -18, ratio: 3 })
  let withUp = compressor(d, { threshold: -18, ratio: 3, upThreshold: -30, upRatio: 1, upKnee: 4, upRange: 6 })
  is(plain.length, withUp.length)
  for (let i = 0; i < plain.length; i++) if (plain[i] !== withUp[i]) throw new Error(`diverges at ${i}: ${plain[i]} vs ${withUp[i]}`)
  ok(true, 'identical')
})

test('compressor upward — knee 0 yields no NaN', () => {
  let d = sine(1000, fs >> 2, 0.5)
  let out = compressor(d, { threshold: -20, ratio: 4, upThreshold: -30, upRatio: 3, upKnee: 0, upRange: 20 })
  for (let i = 0; i < out.length; i++) if (Number.isNaN(out[i])) throw new Error(`NaN at ${i}`)
  ok(true, 'no NaN with upward hard knee')
})


// --- limiter ---

test('limiter — peak never exceeds ceiling', () => {
  let loud = sine(500, fs >> 1, 0.95)
  let out = limiter(loud, { ceiling: -6, lookahead: 5, release: 20 })
  let ceilLin = Math.pow(10, -6 / 20)
  ok(peak(out) <= ceilLin * 1.02, `peak ${peak(out).toFixed(3)} ≤ ${ceilLin.toFixed(3)}`)
})

test('limiter — passes signal below ceiling', () => {
  let quiet = sine(500, fs >> 2, 0.1)
  let out = limiter(quiet, { ceiling: -6 })
  almost(peak(out), peak(quiet), 0.01, 'passes')
})

test('limiter — brickwall holds on isolated transient', () => {
  // A single spike followed by silence: the envelope must not release below
  // a delayed peak still in the lookahead buffer.
  let d = new Float32Array(2048)
  d[100] = 1
  let out = limiter(d, { ceiling: -6, lookahead: 5, release: 50 })
  let ceilLin = Math.pow(10, -6 / 20)
  ok(peak(out) <= ceilLin * (1 + 1e-6), `peak ${peak(out).toFixed(4)} ≤ ${ceilLin.toFixed(4)}`)
})

test('limiter: gain ramps into a peak across the lookahead, no step', () => {
  let n = fs / 2, x = new Float32Array(n)
  for (let i = 0; i < n; i++) x[i] = (i >= fs / 4 && i < fs / 4 + 441 ? 1 : 0.1) * Math.sin(2 * Math.PI * 1000 * i / fs)
  let la = 5, L = Math.round(la * fs / 1000)
  let y = limiter(x, { ceiling: -6, lookahead: la, release: 50, sampleRate: fs })
  let maxStep = 0
  // the gain on the steady part before the burst, where it ramps down: output/input on samples over 0.05
  for (let i = fs / 4 - L - 50; i < fs / 4; i++) if (Math.abs(x[i]) > 0.05 && Math.abs(x[i - 1]) > 0.05) maxStep = Math.max(maxStep, Math.abs(y[i] / x[i] - y[i - 1] / x[i - 1]))
  let depth = 1 - 10 ** (-6 / 20)
  ok(maxStep <= 1.5 * depth / L, 'largest gain change per sample ' + maxStep.toFixed(4) + ' ≤ ' + (1.5 * depth / L).toFixed(4) + ' (a ramp over ' + L + ' samples)')
  ok(peak(y) <= 10 ** (-6 / 20) + 1e-6, 'ceiling holds: ' + db(peak(y)).toFixed(3) + ' dB')
})

test('limiter — streaming matches batch exactly', () => {
  let data = sine(500, 4096, 0.9)
  let batch = limiter(data, { ceiling: -6, lookahead: 5, release: 20 })
  let write = limiter({ ceiling: -6, lookahead: 5, release: 20 })
  let a = write(data.subarray(0, 1000))
  let b = write(data.subarray(1000))
  let tail = write()
  let stream = new Float32Array(batch.length)
  stream.set(a); stream.set(b, a.length); stream.set(tail, a.length + b.length)
  for (let i = 0; i < batch.length; i++)
    if (batch[i] !== stream[i]) throw new Error(`diverges at ${i}: ${batch[i]} vs ${stream[i]}`)
  ok(true, 'identical')
})

test('limiter — streaming preserves length', () => {
  let data = sine(500, 4096, 0.9)
  let write = limiter({ ceiling: -6 })
  let a = write(data.subarray(0, 2048))
  let b = write(data.subarray(2048))
  let tail = write()
  is(a.length + b.length + tail.length, data.length)
})

/** Band-limited true peak, dBTP: the waveform read 32 points a sample through a Kaiser-windowed sinc (β 14, 64 samples
 *  each side), near every sample within 3 dB of the largest: a finer reader than the limiter's (audio's test/pro.js). */
function bandPeak(x) {
  let i0 = z => { let s = 1, t = 1; for (let k = 1; k < 60; k++) s += t *= (z / 2 / k) ** 2; return s }, I = i0(14)
  let sinc = x => x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x)
  let K = Array.from({ length: 32 }, (_, p) => Float64Array.from({ length: 128 }, (_, j) => { let d = 63 - j + p / 32; return Math.abs(d) >= 64 ? 0 : sinc(d) * i0(14 * Math.sqrt(1 - (d / 64) ** 2)) / I }))
  let pk = 0, top = peak(x)
  for (let i = 0; i < x.length; i++) {
    pk = Math.max(pk, Math.abs(x[i]))
    if (Math.max(Math.abs(x[i]), Math.abs(x[i + 1] ?? 0)) < top * 0.708) continue
    for (let p = 1; p < 32; p++) { let h = K[p], y = 0; for (let j = 0; j < 128; j++) { let k = i - 63 + j; if (k >= 0 && k < x.length) y += h[j] * x[k] } pk = Math.max(pk, Math.abs(y)) }
  }
  return db(pk)
}

test('limiter truePeak: a sine at fs/4, 45° on, whose samples sit 3 dB under its peak', () => {
  // ITU-R BS.1770-4 Annex 2's case for reading between samples: the samples of sin(πn/2 + π/4) are ±0.707,
  // the waveform reaches 1. Sample-peak limiting at -1 dB lets it through at 0 dBTP; true-peak holds -1 dBTP.
  // Once the gain settles, consecutive samples are the sine in quadrature: its amplitude is their hypotenuse.
  let x = Float32Array.from({ length: fs / 2 }, (_, n) => Math.sin(Math.PI * n / 2 + Math.PI / 4))
  let amp = y => db(Math.hypot(y[fs / 4], y[fs / 4 + 1]))
  almost(amp(limiter(x, { ceiling: -1 })), 0, 1e-6, 'sample peak: 0 dBTP')
  let tp = amp(limiter(x, { ceiling: -1, truePeak: true }))
  ok(tp <= -1 + 1e-4 && tp > -1.05, `true peak: ${tp.toFixed(4)} dBTP`)
})

test('limiter truePeak: full-band noise and a burst limited 20 dB, the band-limited peak at the ceiling', () => {
  let seed = 7, rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  for (let sr of [8000, 44100, 48000]) {
    let x = Float32Array.from({ length: sr }, (_, i) => (rnd() * 2 - 1) * (i > sr / 2 && i < sr * 0.6 ? 10 : 1))
    let tp = bandPeak(limiter(x, { ceiling: -1, truePeak: true, sampleRate: sr }))
    ok(tp <= -1 + 0.006, `${sr} Hz: ${tp.toFixed(4)} dBTP`)
  }
})

test('limiter truePeak: latency, alignment, streaming', () => {
  let sr = 48000
  is(limiterLatency({ lookahead: 5, sampleRate: sr, truePeak: true }), 240 + 96, '48 + lookahead + 48 samples')
  let x = new Float32Array(4096); x[1000] = 0.1
  let y = limiter(x, { sampleRate: sr, truePeak: true })
  is(y.length, x.length, 'as long as the input')
  is(y.indexOf(Math.max(...y)), 1000, 'aligned with it')
  let data = sine(500, 4096, 0.9), batch = limiter(data, { ceiling: -6, truePeak: true })
  let write = limiter({ ceiling: -6, truePeak: true }), parts = [write(data.subarray(0, 777)), write(data.subarray(777)), write()]
  let stream = new Float32Array(batch.length), o = 0
  for (let p of parts) { stream.set(p, o); o += p.length }
  is(stream, batch, 'streaming matches batch')
  // shorter than its delay (336 samples), one sample, none: as long as it went in, the peak held
  for (let n of [100, 1, 0]) {
    let x = new Float32Array(n).fill(0.99), y = limiter(x, { ceiling: -6, truePeak: true, sampleRate: sr })
    is(y.length, n, `${n} samples in, ${n} out`)
    ok(y.every(v => v <= 10 ** (-6 / 20) + 1e-6), `${n}: under the ceiling`)
  }
})


// --- gate ---

test('gate — silences below threshold', () => {
  let quiet = sine(1000, fs >> 2, 0.001)  // -60 dB
  let out = gate(quiet, { threshold: -40, range: -80, hold: 0, attack: 0.1, release: 1 })
  ok(rms(out) < rms(quiet) * 0.1, 'attenuated')
})

test('gate — passes signal above threshold', () => {
  let loud = sine(1000, fs >> 2, 0.5)    // ≈ -6 dB
  let out = gate(loud, { threshold: -40 })
  almost(rms(out), rms(loud), rms(loud) * 0.1, 'passes')
})

test('gate — hysteresis: level inside the open/close band holds the gate open', () => {
  let loud = sine(1000, fs >> 3, 0.5)                     // -6 dB opens the gate
  let mid = sine(1000, fs >> 1, 0.007)                    // ≈ -43 dB: inside (-46, -40)
  let x = new Float32Array([...loud, ...mid])
  let opts = { threshold: -40, range: -80, hold: 0, attack: 0.1, release: 1 }
  let hyst = gate(x, { ...opts, closeThreshold: -46 })
  let tail = hyst.subarray(loud.length + (fs >> 3))       // well past the transition
  let ref = mid.subarray(fs >> 3)
  almost(rms(tail), rms(ref), rms(ref) * 0.15, 'stays open inside hysteresis band')
  let flat = gate(x, { ...opts, closeThreshold: -40 })    // no hysteresis: close == open
  ok(rms(flat.subarray(loud.length + (fs >> 3))) < rms(ref) * 0.1, 'same level closes without hysteresis')
})

test('gate — look-ahead opens before the transient; batch stays sample-aligned', () => {
  let pre = new Float32Array(fs >> 2)                     // silence
  let burst = sine(1000, fs >> 2, 0.5)
  let x = new Float32Array([...pre, ...burst])
  let opts = { threshold: -40, range: -80, hold: 0, attack: 5, release: 10 }
  let noLa = gate(x, opts)
  let la = gate(x, { ...opts, lookahead: 5 })
  is(la.length, x.length, 'length preserved (write + flush covers the signal)')
  let onset = Math.round(0.002 * fs)                      // first 2 ms of the burst
  ok(rms(la.subarray(pre.length, pre.length + onset)) > rms(noLa.subarray(pre.length, pre.length + onset)) * 2,
    'onset preserved vs no look-ahead')
  let steady = rms(burst.subarray(fs / 20 | 0))
  almost(rms(la.subarray(pre.length + (fs / 20 | 0))), steady, steady * 0.1, 'steady state passes')
  ok(rms(la.subarray(0, pre.length - Math.round(0.005 * fs))) < 1e-4, 'silence stays gated, no delay-line garbage')
})


// --- expander ---

test('expander — gentle reduction below threshold', () => {
  let quiet = sine(1000, fs >> 2, 0.03)  // ≈ -30 dB
  let out = expander(quiet, { threshold: -20, ratio: 2, range: -20, attack: 1, release: 5 })
  ok(rms(out) < rms(quiet), 'reduced')
  ok(rms(out) > rms(quiet) * 0.05, 'not full gate')
})


test('expander — hard knee (knee: 0) yields no NaN', () => {
  let quiet = sine(1000, fs >> 2, 0.03)
  let out = expander(quiet, { threshold: -30, ratio: 2, knee: 0 })
  for (let i = 0; i < out.length; i++) if (Number.isNaN(out[i])) throw new Error(`NaN at ${i}`)
  ok(rms(out) < rms(quiet), 'expands')
})


// --- expander: upward (de-compression — the substrate for de-limiting over-squashed
// material; same four-quadrant taxonomy as compressor's upward mode) ---

test('expander upward — de-compression static curve', () => {
  let sr = 44100
  let amp = Math.SQRT2 * 10 ** (-10 / 20)
  let d = sine(1000, sr, amp)
  let out = expander(d, { mode: 'upward', threshold: -20, ratio: 1.5, knee: 0, detector: 'rms' })
  let lift = toDb(rmsOf(out, sr / 2)) - toDb(rmsOf(d, sr / 2))
  almost(lift, 5, 0.7, `lift ${lift.toFixed(2)} dB`)   // 10 · (1.5 − 1) = 5 dB
})

test('expander upward — below threshold untouched', () => {
  let sr = 44100
  let d = tone(-30, 0.5, 1000, sr)
  let out = expander(d, { mode: 'upward', threshold: -20, ratio: 2 })
  let delta = toDb(rmsOf(out, sr / 4)) - toDb(rmsOf(d, sr / 4))
  almost(delta, 0, 0.2, `untouched: ${delta.toFixed(3)} dB`)
})


// --- unlimit (de-limiter — classical counterpart to iZotope Ozone 12's "Unlimiter";
// transient-gated upward expansion restoring crest a brickwall limiter flattened;
// see expander.js's upwardExpanderGain, the curve substrate this atom reuses) ---

// Deterministic "drummy" fixture: 8 decaying-sine hits (kick-like) + a hat-like seeded-
// noise layer, ~2s. LCG noise matches the org convention (@audio/mir test.js's kick/
// snare/hat fixtures): r = (r·1664525 + 1013904223) mod 2³², mapped to [-1, 1).
function drumHit(n, sr) {
  let d = new Float32Array(n)
  for (let i = 0; i < n; i++) { let t = i / sr; d[i] = Math.exp(-t * 30) * Math.sin(2 * Math.PI * 80 * t) }
  return d
}
function hatHit(n, sr, seed) {
  let d = new Float32Array(n), r = seed >>> 0
  for (let i = 0; i < n; i++) {
    let t = i / sr
    r = (r * 1664525 + 1013904223) >>> 0
    d[i] = Math.exp(-t * 60) * (r / 2147483648 - 1)
  }
  return d
}
function drummy(sr = fs, seed = 12345, hitGain = 1, hatGain = 0.35, spacing = 0.235) {
  let n = Math.round(2 * sr), d = new Float32Array(n)
  let hitLen = Math.round(0.15 * sr)
  for (let h = 0; h < 8; h++) {
    let at = Math.round((0.1 + h * spacing) * sr)
    let dh = drumHit(hitLen, sr), hh = hatHit(hitLen, sr, seed + h * 101)
    for (let i = 0; i < hitLen && at + i < n; i++) d[at + i] += dh[i] * hitGain + hh[i] * hatGain
  }
  return d
}
const crestDb = (d) => db(peak(d)) - db(rms(d))
function pearson(a, b) {
  let n = Math.min(a.length, b.length), ma = 0, mb = 0
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i] }
  ma /= n; mb /= n
  let num = 0, da = 0, dbb = 0
  for (let i = 0; i < n; i++) { let xa = a[i] - ma, xb = b[i] - mb; num += xa * xb; da += xa * xa; dbb += xb * xb }
  return num / Math.sqrt(da * dbb)
}
function envFrames(d, sr, frameMs = 5) {
  let fl = Math.round(frameMs * 0.001 * sr), n = Math.floor(d.length / fl)
  let out = new Float64Array(n)
  for (let f = 0; f < n; f++) out[f] = rmsOf(d, f * fl, (f + 1) * fl)
  return out
}
// Aggressive brickwall drive shared by the recovery tests below — crest drops ≥6 dB
// (checked explicitly), well past the ≥6 dB the test spec requires.
const UNLIMIT_TEST_LIMITER = { ceiling: -26, lookahead: 1, release: 8 }

test('unlimit — crest restoration: recovers toward original after heavy limiting', () => {
  let d = drummy()
  let origCrest = crestDb(d)
  let lim = limiter(d, UNLIMIT_TEST_LIMITER)
  let limCrest = crestDb(lim)
  ok(origCrest - limCrest >= 6, `fixture: limiter drops crest ${(origCrest - limCrest).toFixed(2)} dB (need ≥6)`)
  let out = unlimit(lim, { amount: 9, drive: 2 })
  let unCrest = crestDb(out)
  ok(unCrest >= limCrest + 3, `restored ${unCrest.toFixed(2)} dB ≥ limited+3 (${(limCrest + 3).toFixed(2)})`)
  ok(unCrest <= origCrest + 1, `restored ${unCrest.toFixed(2)} dB ≤ original+1 (${(origCrest + 1).toFixed(2)}); recovers toward, never overshoots absurdly`)
})

test('unlimit — envelope-shape recovery: 5ms envelope correlates better with original than the limited signal does', () => {
  let d = drummy()
  let lim = limiter(d, UNLIMIT_TEST_LIMITER)
  let out = unlimit(lim, { amount: 9, drive: 2 })
  let eOrig = envFrames(d, fs), eLim = envFrames(lim, fs), eOut = envFrames(out, fs)
  let rLim = pearson(eOrig, eLim), rOut = pearson(eOrig, eOut)
  ok(rOut - rLim >= 0.05, `Pearson r ${rLim.toFixed(3)} → ${rOut.toFixed(3)} (Δ${(rOut - rLim).toFixed(3)}, need ≥0.05) — "it moves again"`)
})

test('unlimit — near-identity on already-dynamic material (default settings)', () => {
  let d = drummy()
  let out = unlimit(d, {})
  let dRms = db(rms(out)) - db(rms(d)), dPeak = db(peak(out)) - db(peak(d))
  ok(Math.abs(dRms) <= 0.5, `rms Δ${dRms.toFixed(3)} dB (≤0.5)`)
  ok(Math.abs(dPeak) <= 1, `peak Δ${dPeak.toFixed(3)} dB (≤1) — transient detector fires, but the lift stays small relative`)
})

test('unlimit — sustained tone untouched (no transients, no lift)', () => {
  let t = sine(440, fs, 0.5)
  let out = unlimit(t, {})
  let half = fs >> 1   // skip the first 0.5s so the detector has settled
  let delta = db(rmsOf(out, half)) - db(rmsOf(t, half))
  almost(delta, 0, 0.1, `steady-state Δ${delta.toFixed(4)} dB`)
})

test('unlimit — amount: 0 is bit-exact identity', () => {
  let d = drummy()
  let out = unlimit(d, { amount: 0 })
  is(out.length, d.length)
  for (let i = 0; i < d.length; i++) if (out[i] !== d[i]) throw new Error(`diverges at ${i}: ${d[i]} vs ${out[i]}`)
  ok(true, 'identical')
})

test('unlimit — ceiling guards restored peaks', () => {
  let d = drummy(fs, 999, 3, 1)   // hotter fixture + aggressive drive: forces overshoot without a ceiling
  let out = unlimit(d, { amount: 9, drive: 3, ceiling: -1 })
  let ceilLin = Math.pow(10, -1 / 20)
  ok(peak(out) <= ceilLin * Math.pow(10, 0.1 / 20), `peak ${db(peak(out)).toFixed(3)} dB ≤ -1 + 0.1 dB`)
})

test('unlimit — streaming matches batch; deterministic; no NaN', () => {
  let d = drummy()
  let opts = { amount: 9, drive: 3 }
  let batch = unlimit(d, opts)
  let write = unlimit(opts)
  let a = write(d.subarray(0, 30000))
  let b = write(d.subarray(30000))
  let tail = write()
  is(a.length + b.length + tail.length, batch.length, 'streaming length matches batch')
  let stream = new Float32Array(batch.length)
  stream.set(a); stream.set(b, a.length); stream.set(tail, a.length + b.length)
  for (let i = 0; i < batch.length; i++) if (Math.abs(batch[i] - stream[i]) > 1e-6) throw new Error(`diverges at ${i}: ${batch[i]} vs ${stream[i]}`)
  ok(true, 'streaming ≈ batch')
  ok(batch.every(isFinite) && stream.every(isFinite), 'no NaN/Inf')
  let batch2 = unlimit(d, opts)
  let deterministic = true
  for (let i = 0; i < batch.length; i++) if (batch[i] !== batch2[i]) { deterministic = false; break }
  ok(deterministic, 'deterministic across repeated calls')
})


// --- deesser ---

// a vowel: 150 Hz harmonics to 3 kHz at 1/k; an 's': 40 partials over 4–9 kHz at random phases, a fricative's noise
// band; each faded in and out over 10 ms, as a sound starts
function partials(n, list, amp, seed = 1) {
  let d = new Float32Array(n), r = seed, m = fs / 100
  for (let [f, a] of list) {
    r = (Math.imul(r, 1664525) + 1013904223) >>> 0
    let ph = 2 * Math.PI * r / 4294967296
    for (let i = 0; i < n; i++) d[i] += a * Math.sin(2 * Math.PI * f * i / fs + ph)
  }
  let k = amp / peak(d)
  return d.map((v, i) => v * k * Math.min(1, i / m, (n - 1 - i) / m))
}
const vowel = (n, amp = 0.5) => partials(n, Array.from({ length: 20 }, (_, k) => [150 * (k + 1), 1 / (k + 1)]), amp)
const esses = (n, amp = 0.5, seed = 7) => partials(n, Array.from({ length: 40 }, (_, k) => [4000 + 5000 * k / 39, 1]), amp, seed)
const join = (...a) => { let o = new Float32Array(a.reduce((s, x) => s + x.length, 0)), p = 0; for (let x of a) o.set(x, p), p += x.length; return o }
const gain = (x, dB) => x.map(v => v * 10 ** (dB / 20))

test('deesser — an s is cut by at most range, and by the same dB at any level', () => {
  // vowel, s, vowel; the cut on the s's steady half at −40, −20 and 0 dB. 0.2.x cut it 0, 0, 5.2 dB (a threshold on
  // the band's own level), and as deep as the excess asked, with no bound
  let n = fs / 4, x = join(vowel(n), esses(n), vowel(n)), a = n + n / 2, b = 2 * n
  for (let mode of ['split', 'broadband', 'band']) {
    let cuts = [-40, -20, 0].map(L => { let xg = gain(x, L), y = deesser(xg, { mode, sampleRate: fs }); return db(rms(y.subarray(a, b)) / rms(xg.subarray(a, b))) })
    ok(cuts.every(c => c <= -3 && c >= -8.1), `${mode}: the s cut 3–8 dB (${cuts.map(c => c.toFixed(2))})`)
    ok(Math.max(...cuts) - Math.min(...cuts) < 0.1, `${mode}: the same cut at −40, −20, 0 dB`)
    let deep = deesser(gain(x, 0), { mode, sampleRate: fs, range: -3 }).subarray(a, b)
    ok(db(rms(deep) / rms(gain(x, 0).subarray(a, b))) >= -3.05, `${mode}: range −3 holds it to 3 dB`)
    let after = deesser(x, { mode, sampleRate: fs }).subarray(2 * n + fs / 20)
    ok(Math.abs(db(rms(after) / rms(x.subarray(2 * n + fs / 20)))) < 0.05, `${mode}: the vowel after it is back within 50 ms`)
  }
})

// 0.3.0 cut with no look-ahead, broadband, and at most 6 dB: an 's' made 8 dB too bright between two vowels lost 10.6 dB
// of its error to the clean 's' (band mode 6.1), its onset passing before the cut. Now the cut is read 5 ms ahead, on
// the band over 3.5 kHz only, at most 8 dB.
test('deesser – an s made 8 dB too bright comes back to the clean one, its onset too', () => {
  let n = fs / 4, clean = join(vowel(n), esses(n, 0.15), vowel(n)), harsh = join(vowel(n), esses(n, 0.15 * 10 ** (8 / 20)), vowel(n)), a = n - fs / 100, b = 2 * n + fs / 100
  for (let [mode, min] of [['split', 15], ['band', 8]]) {
    let y = deesser(harsh, { mode, sampleRate: fs }), e0 = 0, e1 = 0
    for (let i = a; i < b; i++) e0 += (harsh[i] - clean[i]) ** 2, e1 += (y[i] - clean[i]) ** 2
    ok(10 * Math.log10(e0 / e1) > min, `${mode}: the error to the clean s taken away ${(10 * Math.log10(e0 / e1)).toFixed(1)} dB (> ${min})`)
    ok(y.subarray(0, n - fs / 50).every((v, i) => v === clean[i]), `${mode}: the vowel before it comes back sample for sample, aligned`)
  }
})

test('deesser — a vowel, and a bright sound under a full body (a cymbal in a mix), pass untouched', () => {
  let v = vowel(fs / 2), body = vowel(fs / 2, 0.8), hf = esses(fs / 2, 1, 3)
  let mix = body.map((s, i) => s + hf[i] * rms(body) / rms(hf) * 10 ** (-12 / 20))   // the bright band 12 dB under
  for (let mode of ['split', 'broadband', 'band']) for (let L of [-40, 0]) {
    let xv = gain(v, L), yv = deesser(xv, { mode, sampleRate: fs }), xm = gain(mix, L), ym = deesser(xm, { mode, sampleRate: fs })
    ok(yv.every((s, i) => s === xv[i]), `${mode} at ${L} dB: a vowel is passed sample for sample`)
    ok(ym.every((s, i) => s === xm[i]), `${mode} at ${L} dB: the bright mix is passed sample for sample`)
  }
})

test('deesser — hiss in a pause is not taken for an s', () => {
  // white noise 50 dB under the voice, after it: sibilance-shaped, but measured against the voice's running level
  let n = fs / 2, r = 9, hiss = Float32Array.from({ length: n }, () => (r = (Math.imul(r, 1664525) + 1013904223) >>> 0, (r / 2147483648 - 1) * 0.5 * 10 ** (-50 / 20)))
  let x = join(vowel(n), hiss), a = n + fs / 20
  for (let mode of ['split', 'broadband', 'band']) {
    let y = deesser(x, { mode, sampleRate: fs })
    ok(Math.abs(db(rms(y.subarray(a)) / rms(x.subarray(a)))) < 0.1, `${mode}: the hiss keeps its level`)
  }
})

test('deesser — former option names freq/q still work', () => {
  let x = sine(6000, fs >> 2, 0.5)
  for (let mode of ['broadband', 'band']) {
    let a = deesser(Float32Array.from(x), { mode, fc: 5500, Q: 3 })
    let b = deesser(Float32Array.from(x), { mode, freq: 5500, q: 3 })
    ok(a.every((v, i) => v === b[i]), `${mode}: { freq, q } ≡ { fc, Q }`)
  }
})

test('deesser – split and band modes cut only their band', () => {
  let n = fs >> 1, x = new Float32Array(n)
  for (let i = 0; i < n; i++) x[i] = 0.3 * Math.sin(2 * Math.PI * 220 * i / fs) + 0.6 * Math.sin(2 * Math.PI * 7000 * i / fs)
  let broad = deesser(x, { fc: 7000, mode: 'broadband' })
  for (let mode of ['split', 'band']) {
    let y = deesser(x, { fc: 7000, mode })
    ok(energyAt(y, 7000) < energyAt(x, 7000) * 0.7, `${mode}: sibilance band cut`)
    ok(energyAt(y, 220) > energyAt(x, 220) * 0.99, `${mode}: program below the band untouched`)
    ok(energyAt(y, 220) > energyAt(broad, 220), `${mode}: keeps the low end broadband takes`)
  }
})

test('deesser — edge cases: empty, one sample, under a block, silence, any chunking, finite', () => {
  let x = join(vowel(fs / 4), esses(fs / 4), vowel(fs / 4))
  for (let mode of ['split', 'broadband', 'band']) {
    is(deesser(new Float32Array(0), { mode }).length, 0, `${mode}: empty`)
    let one = deesser(new Float32Array([0.5]), { mode })
    ok(one.length === 1 && isFinite(one[0]), `${mode}: one sample`)
    let short = deesser(Float32Array.from({ length: 10 }, (_, i) => Math.sin(i)), { mode })
    ok(short.length === 10 && short.every(isFinite), `${mode}: under a block`)
    ok(deesser(new Float32Array(fs / 10), { mode }).every(v => v === 0), `${mode}: silence stays silence`)
    let batch = deesser(x, { mode, sampleRate: fs }), write = deesser({ mode, sampleRate: fs }), parts = [], p = 0
    for (let k of [1, 63, 333, 4096, 64]) { parts.push(write(x.subarray(p, p + k))); p += k }
    parts.push(write(x.subarray(p)), write())
    let L = latency(fs), all = join(...parts)
    ok(all.length === x.length + L && batch.every((v, i) => v === all[i + L]), `${mode}: chunks of 1, 63, 333, … give the batch's samples, ${L} late`)
    let r = 5, wild = Float32Array.from({ length: fs / 10 }, (_, i) => (r = (Math.imul(r, 1664525) + 1013904223) >>> 0, i % 1000 < 500 ? (r / 2147483648 - 1) : 1e-30 * (r & 1)))
    ok(deesser(wild, { mode, sampleRate: fs }).every(isFinite), `${mode}: full-scale noise and denormals stay finite`)
    ok(deesser(x, { mode, sampleRate: 8000 }).every(isFinite), `${mode}: fc above Nyquist at 8 kHz stays finite`)
  }
})


// --- ducker ---

test('ducker — attenuates main when side is loud', () => {
  let main = sine(500, fs >> 1, 0.5)
  let sideLoud = sine(1000, fs >> 1, 0.5)
  let sideQuiet = new Float32Array(fs >> 1)
  let ducked = ducker(main, sideLoud, { threshold: -20, ratio: 8, attack: 1, release: 5, range: -20 })
  let pass = ducker(main, sideQuiet, { threshold: -20, ratio: 8 })
  ok(rms(ducked) < rms(pass) * 0.8, 'main reduced under loud side')
  almost(rms(pass), rms(main), rms(main) * 0.01, 'passes under silent side')
})


// --- softclip ---

test('softclip — tanh bounds output', () => {
  let d = new Float32Array([3, 2, 1, 0, -1, -2, -3])
  let out = softclip(d, { curve: 'tanh', drive: 1, ceiling: 1 })
  for (let i = 0; i < out.length; i++) ok(Math.abs(out[i]) <= 1.0, `|out[${i}]| ≤ 1`)
})

test('softclip — hard curve clips precisely', () => {
  let d = new Float32Array([1.5, 0.3, -1.5])
  let out = softclip(d, { curve: 'hard', ceiling: 0.8 })
  almost(out[0], 0.8, 1e-6)
  almost(out[1], 0.3, 1e-6)
  almost(out[2], -0.8, 1e-6)
})

test('softclip — preserves small signals linearly', () => {
  let d = sine(1000, 512, 0.1)
  let out = softclip(d, { curve: 'tanh', drive: 1 })
  almost(rms(out), rms(d), rms(d) * 0.02, 'near-linear at low level')
})

test('softclip — oversample reduces aliasing (10 kHz through hard clip, drive 4)', () => {
  // 3rd harmonic of 10 kHz = 30 kHz aliases to 44100−30000 = 14100 Hz without
  // oversampling; mirrors @audio/saturate's alias-floor recipe (Goertzel at the
  // alias bin, naive vs oversampled, edges trimmed against resample-kernel taper).
  let naive = softclip(sine(10000, fs, 0.7), { curve: 'hard', drive: 4, oversample: 1 })
  let os = softclip(sine(10000, fs, 0.7), { curve: 'hard', drive: 4, oversample: 4 })
  let trim = d => d.subarray(2048, d.length - 2048)
  let aliasNaive = energyAt(trim(naive), fs - 30000)
  let aliasOs = energyAt(trim(os), fs - 30000)
  ok(aliasOs < aliasNaive * 10 ** (-12 / 20),
    `alias floor −${(20 * Math.log10(aliasNaive / aliasOs)).toFixed(1)} dB vs naive (≥12 dB required)`)
})

test('softclip — oversample: 1 exactly preserves current behavior', () => {
  let d = sine(1000, 2048, 0.6)
  let ref = softclip(d, { curve: 'tanh', drive: 2 })              // oversample omitted
  let explicit = softclip(d, { curve: 'tanh', drive: 2, oversample: 1 })
  is(ref.length, explicit.length)
  for (let i = 0; i < ref.length; i++) if (ref[i] !== explicit[i]) throw new Error(`diverges at ${i}`)
  ok(true, 'identical whether oversample is omitted or explicit 1')
})

test('softclip — output length preserved under oversampling', () => {
  let d = sine(1000, 4001, 0.5)   // odd length stresses the resample round-trip's rounding
  for (let os of [1, 2, 4, 8]) {
    let out = softclip(d, { curve: 'tanh', drive: 1.5, oversample: os })
    is(out.length, d.length, `oversample ${os} preserves length`)
  }
})


// --- compand ---

test('compand — default compresses loud', () => {
  let loud = sine(500, fs >> 1, 0.8)
  let out = compand(loud, { attack: 1, release: 5 })
  ok(rms(out) < rms(loud), 'loud reduced')
})

test('compand — identity points pass signal', () => {
  let d = sine(500, fs >> 2, 0.5)
  let out = compand(d, { points: [[-90, -90], [0, 0]], attack: 0.1, release: 0.1 })
  almost(rms(out), rms(d), rms(d) * 0.05, 'identity')
})

function impulse (n = 64) { let d = new Float64Array(n); d[0] = 1; return d }

test('transientShaper — produces output without NaN', () => {
	let data = impulse(4096)
	// Add some signal
	for (let i = 0; i < 100; i++) data[i] = Math.sin(2 * Math.PI * 440 * i / 44100) * (1 - i / 100)
	transientShaper(data, { attackGain: 2, sustainGain: -0.5, fs: 44100 })
	ok(data.every(isFinite), 'no NaN/Inf')
	ok(data.some(x => Math.abs(x) > 0.001), 'has output')
})


test('transientShaper — held tones keep their level; the gain stays between the two gains', () => {
	// The detector divided by the slow envelope (≈0 at an onset): gains reached 35× at
	// attackGain 2, and a held sine read as ~0.5 "transient", so attackGain raised steady tones
	let hits = new Float32Array(fs)
	for (let i = 0; i < fs; i++) { let t = (i % (fs / 4)) / fs; hits[i] = 0.2 * Math.sin(2 * Math.PI * 110 * i / fs) + 0.7 * Math.exp(-t * 30) * Math.sin(2 * Math.PI * 80 * t) }
	for (let [attackGain, sustainGain] of [[2, 0], [-1, 0], [0, 2], [0, -1], [2, -1], [-1, 2]]) {
		let x = Float32Array.from(hits), y = transientShaper(Float32Array.from(x), { attackGain, sustainGain, fs })
		let lo = 1 + Math.min(attackGain, sustainGain), hi = 1 + Math.max(attackGain, sustainGain), bad = 0
		for (let i = 0; i < x.length; i++) if (Math.abs(y[i]) > hi * Math.abs(x[i]) + 1e-6 || Math.abs(y[i]) < lo * Math.abs(x[i]) - 1e-6) bad++
		is(bad, 0, `attack ${attackGain}, sustain ${sustainGain}: gain within [${lo}, ${hi}]`)
	}
	let tone = sine(440, fs, 0.5), held = tone.subarray(fs / 2)
	let db = 20 * Math.log10(rms(transientShaper(Float32Array.from(tone), { attackGain: 2, fs }).subarray(fs / 2)) / rms(held))
	ok(Math.abs(db) < 0.5, `held tone at attackGain 2: ${db.toFixed(2)} dB`)
	let hit = x => peak(x.subarray(fs / 4, fs / 4 + 882)), tail = x => rms(x.subarray(fs / 4 + 4410, fs / 2))
	let punchy = transientShaper(Float32Array.from(hits), { attackGain: 1, fs }), dry = hits
	ok(hit(punchy) / hit(dry) > 1.4, `attackGain 1 lifts the hit peak ×${(hit(punchy) / hit(dry)).toFixed(2)}`)
	let tucked = transientShaper(Float32Array.from(hits), { sustainGain: -0.5, fs })
	ok(tail(tucked) / tail(dry) < 0.6, `sustainGain −0.5 tucks the tail ×${(tail(tucked) / tail(dry)).toFixed(2)}`)
})

test('transientShaper — state carried on the options object: chunked ≡ one call', () => {
	let x = sine(220, fs, 0.5)
	for (let i = 0; i < fs; i += fs / 4) x.fill(0, i, i + 2000)
	let one = transientShaper(Float32Array.from(x), { attackGain: 1, sustainGain: -0.5, fs })
	let opts = { attackGain: 1, sustainGain: -0.5, fs }, y = Float32Array.from(x)
	for (let i = 0; i < fs; i += 997) transientShaper(y.subarray(i, Math.min(fs, i + 997)), opts)
	let m = 0; for (let i = 0; i < fs; i++) m = Math.max(m, Math.abs(y[i] - one[i]))
	is(m, 0, 'chunked ≡ one call')
})

// single-bin rms (Goertzel)
function energyAt (data, freq, sr = 44100) {
	let w = 2 * Math.PI * freq / sr, cw = Math.cos(w)
	let s1 = 0, s2 = 0
	for (let i = 0; i < data.length; i++) { let s0 = data[i] + 2 * cw * s1 - s2; s2 = s1; s1 = s0 }
	return Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - 2 * cw * s1 * s2)) / data.length
}

test('multiband — transparent without band params (LR flat sum)', () => {
	for (let f of [100, 1000, 8000]) {
		let d = new Float32Array(44100)
		for (let i = 0; i < d.length; i++) d[i] = 0.5 * Math.sin(2 * Math.PI * f * i / 44100)
		let ref = energyAt(d, f)
		multiband(d, { freqs: [200, 2000], fs: 44100 })
		let after = energyAt(d, f)
		let db = 20 * Math.log10(after / ref)
		ok(Math.abs(db) < 0.5, f + ' Hz passes flat (' + db.toFixed(2) + ' dB)')
	}
})

test('multiband — compresses only the targeted band', () => {
	let n = 44100
	let d = new Float32Array(n)
	for (let i = 0; i < n; i++) d[i] = 0.4 * Math.sin(2 * Math.PI * 150 * i / 44100) + 0.4 * Math.sin(2 * Math.PI * 5000 * i / 44100)
	let lo0 = energyAt(d, 150), hi0 = energyAt(d, 5000)
	multiband(d, { freqs: [1000], fs: 44100, bands: [null, { threshold: -30, ratio: 20, knee: 0, attack: 1, release: 50 }] })
	let lo1 = energyAt(d, 150), hi1 = energyAt(d, 5000)
	ok(Math.abs(20 * Math.log10(lo1 / lo0)) < 1, 'low band untouched')
	ok(20 * Math.log10(hi1 / hi0) < -6, 'high band compressed ≥6 dB')
	ok(d.every(isFinite), 'no NaN')
})

// OTT-class upward+downward multiband (Xfer OTT recipe — see README). Quiet 150 Hz
// band should rise (upward compression pulling it toward upThreshold); loud 5 kHz
// band should fall (downward compression pulling it toward threshold).
test('multiband OTT — quiet band lifted, loud band squashed', () => {
	let n = 44100
	let d = new Float32Array(n)
	let loAmp = 10 ** (-45 / 20), hiAmp = 10 ** (-6 / 20)
	for (let i = 0; i < n; i++) d[i] = loAmp * Math.sin(2 * Math.PI * 150 * i / 44100) + hiAmp * Math.sin(2 * Math.PI * 5000 * i / 44100)
	let lo0 = energyAt(d.subarray(n / 2), 150), hi0 = energyAt(d.subarray(n / 2), 5000)
	multiband(d, { freqs: [400, 2000], fs: 44100, bands: { threshold: -24, ratio: 4, upThreshold: -30, upRatio: 2 } })
	ok(d.every(isFinite), 'no NaN')
	let lo1 = energyAt(d.subarray(n / 2), 150), hi1 = energyAt(d.subarray(n / 2), 5000)
	let loDb = 20 * Math.log10(lo1 / lo0), hiDb = 20 * Math.log10(hi1 / hi0)
	ok(loDb >= 3, `150 Hz rises ${loDb.toFixed(1)} dB`)
	ok(hiDb <= -3, `5 kHz falls ${hiDb.toFixed(1)} dB`)
})

test('multiband — depth 0 is identity; depth scales gain monotonically', () => {
	let n = 44100
	let mk = () => { let d = new Float32Array(n); for (let i = 0; i < n; i++) d[i] = 0.5 * Math.sin(2 * Math.PI * 5000 * i / 44100); return d }
	let refE = energyAt(mk().subarray(n / 2), 5000)

	let d0 = mk()
	multiband(d0, { freqs: [400, 2000], fs: 44100, bands: { threshold: -24, ratio: 4, depth: 0 } })
	almost(20 * Math.log10(energyAt(d0.subarray(n / 2), 5000) / refE), 0, 0.1, 'depth 0 is identity')

	let d50 = mk(), d100 = mk()
	multiband(d50, { freqs: [400, 2000], fs: 44100, bands: { threshold: -24, ratio: 4, depth: 0.5 } })
	multiband(d100, { freqs: [400, 2000], fs: 44100, bands: { threshold: -24, ratio: 4, depth: 1 } })
	let red50 = 20 * Math.log10(energyAt(d50.subarray(n / 2), 5000) / refE)
	let red100 = 20 * Math.log10(energyAt(d100.subarray(n / 2), 5000) / refE)
	ok(red100 < red50, `depth 1 reduces more (${red100.toFixed(1)} dB) than depth 0.5 (${red50.toFixed(1)} dB)`)
})

function tone (db, seconds, freq = 997, sr = 44100) {
	let a = 10 ** (db / 20)
	let d = new Float32Array(Math.round(seconds * sr))
	for (let i = 0; i < d.length; i++) d[i] = a * Math.sin(2 * Math.PI * freq * i / sr)
	return d
}
function rmsOf (d, from = 0, to = d.length) {
	let s = 0
	for (let i = from; i < to; i++) s += d[i] * d[i]
	return Math.sqrt(s / (to - from))
}
const toDb = x => 20 * Math.log10(x)

test('models — all four reduce hot material and stay finite; vca transparent below threshold', () => {
	let sr = 44100
	for (let model of [opto, fet, vca, varimu]) {
		let out = model(tone(-6, 1), { threshold: -24, sampleRate: sr })
		ok(out.every(isFinite), 'finite')
		ok(rmsOf(out, sr / 2) < rmsOf(tone(-6, 1)) * 0.8, 'reduces ≥2 dB')
	}
	let quiet = tone(-30, 0.5)
	let out = vca(Float32Array.from(quiet), { threshold: -20, sampleRate: 44100 })
	almost(toDb(rmsOf(out, 4410) / rmsOf(quiet, 4410)), 0, 0.3, 'below threshold untouched')
})

test('fet attacks much faster than varimu', () => {
	let sr = 44100
	let sig = () => { let d = new Float32Array(sr); let s = tone(-6, 0.8); d.set(s, sr - s.length); return d }
	let onset = sr - Math.round(0.8 * sr)
	let overshoot = out => rmsOf(out, onset, onset + 220) / rmsOf(out, sr - 8820, sr) // first 5 ms vs steady
	let f = overshoot(fet(sig(), { threshold: -24, sampleRate: sr }))
	let v = overshoot(varimu(sig(), { threshold: -24, sampleRate: sr }))
	ok(v > f * 1.3, 'varimu lets ' + v.toFixed(2) + '× onset through vs fet ' + f.toFixed(2) + '×')
})

test('opto release is program-dependent (longer reduction → slower recovery)', () => {
	let sr = 44100
	let mk = loudSec => {
		let loud = tone(-6, loudSec), probe = tone(-30, 1)
		let d = new Float32Array(loud.length + probe.length)
		d.set(loud, 0); d.set(probe, loud.length)
		return { d, probeAt: loud.length }
	}
	let a = mk(0.4), b = mk(5)
	let outA = opto(a.d, { threshold: -24, sampleRate: sr })
	let outB = opto(b.d, { threshold: -24, sampleRate: sr })
	let probeA = rmsOf(outA, a.probeAt + 2205, a.probeAt + 8820)
	let probeB = rmsOf(outB, b.probeAt + 2205, b.probeAt + 8820)
	ok(probeA > probeB * 1.05, 'short-burst recovery faster (' + (probeA / probeB).toFixed(3) + '×)')
})

test('varimu ratio grows with drive', () => {
	let sr = 44100
	let g6 = tone(-16, 1.5), g18 = tone(-4, 1.5)
	let r6 = toDb(rmsOf(varimu(g6, { threshold: -22, sampleRate: sr }), sr) / rmsOf(tone(-16, 1.5), sr))
	let r18 = toDb(rmsOf(varimu(g18, { threshold: -22, sampleRate: sr }), sr) / rmsOf(tone(-4, 1.5), sr))
	ok((-r18) / 18 > (-r6) / 6 * 1.1, 'GR/over grows: ' + (-r6).toFixed(1) + ' dB @+6 → ' + (-r18).toFixed(1) + ' dB @+18')
})

test('leveler — sections ride to target, peak-guarded', () => {
	let sr = 44100
	let quiet = tone(-28, 3), loud = tone(-8, 3)
	let d = new Float32Array(quiet.length + loud.length)
	d.set(quiet, 0); d.set(loud, quiet.length)
	leveler(d, { fs: sr, target: -20, smooth: 2 })
	ok(d.every(v => Math.abs(v) <= 1), 'no clipping')
	let qDb = toDb(rmsOf(d, sr, 2 * sr))
	let lDb = toDb(rmsOf(d, quiet.length + sr, quiet.length + 2 * sr))
	almost(qDb, -20, 2.5, 'quiet section ' + qDb.toFixed(1))
	almost(lDb, -20, 2.5, 'loud section ' + lDb.toFixed(1))
})

test('leveler: pauses hold the voice\'s gain: the room between phrases keeps its place under it', () => {
	let sr = 44100, seg = 3 * sr, d = new Float32Array(4 * seg), s = 7
	const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647 - 0.5
	for (let k = 0; k < 4; k++) for (let i = k * seg; i < (k + 1) * seg; i++)
		d[i] = k % 2 ? 2 * 10 ** (-60 / 20) * Math.sqrt(3) * rnd() : Math.SQRT2 * 10 ** (-14 / 20) * Math.sin(2 * Math.PI * 220 * i / sr)
	let x = Float32Array.from(d)
	leveler(d, { fs: sr, target: -20 })
	let voice = toDb(rmsOf(d, sr, 2 * sr) / rmsOf(x, sr, 2 * sr)), room = toDb(rmsOf(d, seg + sr, seg + 2 * sr) / rmsOf(x, seg + sr, seg + 2 * sr))
	almost(voice, -6, 0.5, 'voice at −14 dB rides to −20: ' + voice.toFixed(2) + ' dB')
	almost(room, voice, 1, 'the room moves with it: ' + room.toFixed(2) + ' dB (not up by maxGain)')
})

test('leveler: the peak guard holds after smoothing: nothing past −0.5 dBFS', () => {
	let sr = 44100, d = new Float32Array(6 * sr)
	for (let i = 0; i < d.length; i++) d[i] = Math.SQRT2 * 10 ** (-40 / 20) * Math.sin(2 * Math.PI * 220 * i / sr)
	d[3 * sr + 100] = 0.5
	leveler(d, { fs: sr, target: -20 })
	ok(peak(d) <= 0.94 + 1e-6, 'peak ' + toDb(peak(d)).toFixed(2) + ' dBFS')
})

// --- audit 2026-07-10: ballistics must be rate-invariant (fs/sampleRate seam) ---

test('envelope — fs accepted as sampleRate alias', () => {
	let mk = (opts) => { let e = envelope({ attack: 1, release: 100, ...opts }); let v = 0; for (let i = 0; i < 4410; i++) v = e(1); for (let i = 0; i < 8820; i++) v = e(0); return v }
	let viaFs = mk({ fs: 88200 }), viaSr = mk({ sampleRate: 88200 }), def = mk({})
	is(viaFs, viaSr, 'fs ≡ sampleRate')
	ok(Math.abs(db(viaFs) - db(def)) > 3, 'rate actually changes ballistics (' + db(viaFs).toFixed(1) + ' vs ' + db(def).toFixed(1) + ' dB)')
})

test('multiband — per-band ballistics rate-invariant (was: always 44100)', () => {
	// -6 dB burst then -40 dB tail; gain-recovery trajectory in *seconds* must not
	// depend on fs. Probe a fixed-seconds window early in the tail at two rates.
	let probeDb = (sr) => {
		let n = Math.round(0.8 * sr), d = new Float32Array(n)
		let burstN = Math.round(0.3 * sr)
		for (let i = 0; i < n; i++) d[i] = (i < burstN ? 0.5 : 0.01) * Math.sin(2 * Math.PI * 1000 * i / sr)
		multiband(d, { fs: sr, bands: { threshold: -30, ratio: 8, attack: 1, release: 200 } })
		let a = Math.round((0.3 + 0.03) * sr), b = Math.round((0.3 + 0.06) * sr)
		let s = 0; for (let i = a; i < b; i++) s += d[i] * d[i]
		return db(Math.sqrt(s / (b - a)))
	}
	let p44 = probeDb(44100), p96 = probeDb(96000)
	almost(p44, p96, 0.75, 'recovery trajectory rate-invariant: ' + p44.toFixed(2) + ' vs ' + p96.toFixed(2) + ' dB')
})
