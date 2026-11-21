import test, { almost, ok, is } from 'tst'
import { execFileSync } from 'node:child_process'
import { compressor, limiter, gate, expander, unlimit, deesser, ducker, softclip, compand, envelope, transientShaper, multiband, opto, fet, vca, varimu, leveler } from './index.js'
import { latency, deesserSet, deesserBand } from '@audio/dynamics-deesser'
import { latency as limiterLatency } from '@audio/dynamics-limiter'
import { highpass, lowpass, step, state } from '@audio/biquad'
import crossover from '@audio/eq-crossover'
import { split3 } from '@audio/dynamics-multiband'
import { multiband as multibandAtom } from '@audio/dynamics-multiband/audio'
import { softclip as softclipAtom } from '@audio/dynamics-softclip/audio'
import { oversampler } from '@audio/dynamics-softclip'
import { compand as compandAtom } from '@audio/dynamics-compand/audio'
import { compressor as compressorAtom } from '@audio/dynamics-compressor/audio'
import { deesser as deesserAtom } from '@audio/dynamics-deesser/audio'
import { ducker as duckerAtom } from '@audio/dynamics-ducker/audio'
import { expander as expanderAtom } from '@audio/dynamics-expander/audio'
import { fet as fetAtom } from '@audio/dynamics-fet/audio'
import { gate as gateAtom } from '@audio/dynamics-gate/audio'
import { limiter as limiterAtom } from '@audio/dynamics-limiter/audio'
import { opto as optoAtom } from '@audio/dynamics-opto/audio'
import { unlimit as unlimitAtom } from '@audio/dynamics-unlimit/audio'
import { varimu as varimuAtom } from '@audio/dynamics-varimu/audio'
import { vca as vcaAtom } from '@audio/dynamics-vca/audio'
import { transientShaper as transientShaperAtom } from '@audio/dynamics-transient-shaper/audio'
import { leveler as levelerAtom } from '@audio/dynamics-leveler/audio'
import { compressorGain } from '@audio/dynamics-compressor'

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


// --- manifests (audio.js), driven as a host drives them: an instance from a stub ctx, the signal in calls of `block`
// frames, values changed between calls (contract 1.0: Parameters, Time; Lifecycle) ---

const ATOMS = { compand: compandAtom, compressor: compressorAtom, deesser: deesserAtom, ducker: duckerAtom, expander: expanderAtom, fet: fetAtom, gate: gateAtom, limiter: limiterAtom, multiband: multibandAtom, opto: optoAtom, softclip: softclipAtom, transientShaper: transientShaperAtom, unlimit: unlimitAtom, varimu: varimuAtom, vca: vcaAtom }
const restart = s => s.restart === true || !!s.flags?.includes('restart')
const paramsOf = (m, set = {}) => Object.fromEntries(Object.entries(m.params).map(([k, s]) => { let v = k in set ? set[k] : s.default; return [k, s.type === 'number' ? Float32Array.of(v) : v] }))

// `change`: { at, params } set from frame `at` on, a call starting there; `key`: input bus 1's channels ([] for a bus
// nothing feeds), absent for none
function atomRun (m, x, { params = {}, block = 128, sampleRate = fs, change, key } = {}) {
	let live = paramsOf(m, params), proc = m({ sampleRate, maxBlockSize: block, maxChannels: Math.max(x.length, key?.length ?? 0), params: paramsOf(m, params), buffers: {} })
	let out = x.map(c => new Float32Array(c.length)), n = x[0].length
	for (let i = 0, k; i < n; i += k) {
		k = Math.min(block, n - i)
		if (change && i < change.at && i + k > change.at) k = change.at - i
		if (change && i === change.at) for (let p in change.params) live[p] = m.params[p].type === 'number' ? Float32Array.of(change.params[p]) : change.params[p]
		let ins = [x.map(c => c.subarray(i, i + k))]
		if (key) ins.push(key.map(c => c.subarray(i, i + k)))
		proc(ins, [out.map(c => c.subarray(i, i + k))], live)
	}
	return out
}

// a 200 Hz tone (more for channel c) stepping through -3, -30, -50 and -74 dB, 50 ms each; in the -30 dB step an 's'
// (7 kHz) 20 dB over it
function steps (n, c = 0, sr = fs) {
	let d = new Float32Array(n), lv = [0.7, 0.03, 0.003, 0.0002], m = Math.round(sr / 20)
	for (let i = 0; i < n; i++) {
		let k = Math.floor(i / m) % 4, t = i / sr
		d[i] = lv[k] * Math.sin(2 * Math.PI * (200 + 50 * c) * t) + (k === 1 ? 0.3 * Math.sin(2 * Math.PI * 7000 * t) : 0)
	}
	return d
}
// 90 Hz thuds each 0.1 s, decaying 40/s, an 's' in each, over noise 50 dB down
function thuds (n, c = 0) {
	let d = new Float32Array(n), r = 7 + c
	for (let i = 0; i < n; i++) {
		let t = (i % (fs / 10)) / fs
		r = (Math.imul(r, 1664525) + 1013904223) >>> 0
		d[i] = 0.9 * Math.exp(-t * 40) * Math.sin(2 * Math.PI * 90 * i / fs) + (t > 0.03 && t < 0.06 ? 0.3 : 0) * Math.sin(2 * Math.PI * 7000 * i / fs) + 0.003 * (r / 2147483648 - 1)
	}
	return d
}

test('manifests: restart marks only the params that set the latency, as `restart: true`', () => {
	let marked = []
	for (let [name, m] of Object.entries(ATOMS)) for (let [k, s] of Object.entries(m.params)) {
		ok(!s.flags, `${name}.${k}: no flags`)
		if (!restart(s)) continue
		marked.push(`${name}.${k}`)
		is(s.restart, true, `${name}.${k}: restart: true`)
		let [a, b] = s.type === 'bool' ? [false, true] : [s.min, s.max], at = v => m.latency({ sampleRate: fs, params: paramsOf(m, { [k]: v }) })
		ok(at(a) !== at(b), `${name}.${k} sets the latency: ${at(a)} samples at ${a}, ${at(b)} at ${b}`)
	}
	is(marked, ['deesser.lookahead', 'gate.lookahead', 'limiter.lookahead', 'limiter.truePeak', 'softclip.oversample'])
})

test('manifests: every other param is live: moved mid-signal, it is heard from that call on, and nothing before it moves', () => {
	// settings under which each param is heard: a default can switch its part off (upRatio 1, a ceiling over every peak,
	// band mode's fc and Q), a slow release keep the level over a threshold, a range clamp or a hold cover a change
	const BASES = { compand: [{ release: 5 }], compressor: [{ upRatio: 3 }], deesser: [{}, { mode: 'band' }], ducker: [{ release: 5 }, { range: -12 }], expander: [{ release: 5 }], gate: [{}, { hold: 0, threshold: -25 }], limiter: [{ ceiling: -12 }], multiband: [{ upRatio: 3, release: 20 }] }
	let n = fs / 2, at = 2 * 4410 + 64, other = s => s.type === 'enum' ? s.values.find(v => v !== s.default) : s.type === 'bool' ? !s.default : s.default > (s.min + s.max) / 2 ? s.min : s.max
	for (let [name, m] of Object.entries(ATOMS)) {
		let x = name === 'unlimit' ? [thuds(n), thuds(n, 1)] : [steps(n), steps(n, 1)]
		for (let [k, s] of Object.entries(m.params)) {
			if (restart(s)) continue
			let before = 0, after = 0
			for (let base of BASES[name] ?? [{}]) {
				let a = atomRun(m, x, { params: base }), b = atomRun(m, x, { params: base, change: { at, params: { [k]: other(s) } } })
				for (let c = 0; c < 2; c++) for (let i = 0; i < n; i++) if (a[c][i] !== b[c][i]) i < at ? before++ : after++
			}
			ok(!before && after, `${name}.${k} → ${other(s)}: ${after} samples move after the change, ${before} before`)
		}
	}
})

test('manifests: an attack or release changed while the gain moves is heard from the next sample, the gain continuous', () => {
	// DC levels stepping at 0.3 s (the gain is then out/in, exactly; a sine over DC for the deesser's 's'), the time constant
	// halved 30% into it. With the smoother's state kept, the gain's step across the change is about twice the step before
	// it (a smoother of the linear gain steps a little more in dB: the gate's 2.0001), up to four times where the follower
	// and the gain smoother share the setting (fet, vca, opto, varimu). A reset would jump the distance left, 2.5 to 58 dB
	// here, against steps of 0.0002 to 5 dB
	let s0 = 0.3 * fs | 0, n = s0 + fs / 2, dc = (a, b) => i => i < s0 ? a : b, ess = on => i => 0.02 + (on(i) ? 0.3 * Math.sin(2 * Math.PI * 7000 * i / fs) : 0)
	const MOVES = [
		['compressor', 'release', {}, dc(0.7, 0.01)], ['compressor', 'attack', {}, dc(0.01, 0.7)],
		['fet', 'release', {}, dc(0.7, 0.01)], ['fet', 'attack', {}, dc(0.01, 0.7)],
		['vca', 'release', {}, dc(0.7, 0.01)], ['vca', 'attack', {}, dc(0.01, 0.7)],
		['varimu', 'release', {}, dc(0.7, 0.01)], ['varimu', 'attack', {}, dc(0.01, 0.7)],
		['opto', 'attack', {}, dc(0.01, 0.7)],
		['ducker', 'release', {}, dc(0.5, 0.005)], ['ducker', 'attack', {}, dc(0.005, 0.5)],
		['expander', 'release', {}, dc(0.5, 0.005), 0.13], ['expander', 'attack', {}, dc(0.005, 0.02)],
		['compand', 'release', {}, dc(0.7, 0.001)], ['compand', 'attack', {}, dc(0.001, 0.7)],
		['gate', 'release', {}, dc(0.5, 0.001), 0.01], ['gate', 'attack', {}, dc(0.001, 0.5)],
		['limiter', 'release', { ceiling: -6 }, dc(0.9, 0.3)],
		['unlimit', 'fastRelease', {}, dc(0.1, 0.2), 0.015],
		['deesser', 'release', { mode: 'broadband' }, ess(i => i < s0)], ['deesser', 'attack', { mode: 'broadband' }, ess(i => i >= s0)],
	]
	for (let [name, k, base, f, wait = 0] of MOVES) {
		let m = ATOMS[name], x = Float32Array.from({ length: n }, (_, i) => f(i)), v = m.params[k].default
		let L = typeof m.latency === 'function' ? m.latency({ sampleRate: fs, params: paramsOf(m, base) }) : 0
		let c = s0 + L + Math.round((wait + 0.3 * v * 0.001) * fs) + 1
		let gain = y => Float64Array.from(y[0], (o, i) => i >= L && Math.abs(x[i - L]) > 1e-6 ? db(Math.abs(o / x[i - L])) : NaN)
		let a = gain(atomRun(m, [x], { params: base })), b = gain(atomRun(m, [x], { params: base, change: { at: c, params: { [k]: v / 2 } } }))
		let moved = 0, heard = 0
		for (let i = 0; i < n; i++) { if (i < c && !Object.is(a[i], b[i])) moved++; if (i >= c && i < c + 4000 && a[i] === a[i]) heard = Math.max(heard, Math.abs(a[i] - b[i])) }
		let u = [], i = c - 1, j = c
		while (u.length < 2) { if (b[i] === b[i]) u.unshift(i); i-- }
		while (!(b[j] === b[j])) j++
		let before = Math.abs(b[u[1]] - b[u[0]]), across = Math.abs(b[j] - b[u[1]]), bound = ['fet', 'vca', 'opto', 'varimu'].includes(name) ? 4 : 2.5
		is(moved, 0, `${name}.${k}: nothing before the change moves`)
		ok(heard > 0.01, `${name}.${k} ${v} → ${v / 2} ms: heard, ${heard.toFixed(2)} dB`)
		ok(before > 0 && across <= bound * before, `${name}.${k}: the gain moving ${before.toExponential(2)} dB a sample, then across the change ${across.toExponential(2)} (≤ ${bound}×)`)
	}
})

test('manifests: at settings held throughout, each is its kernel, bit for bit, at any rate, channel count and block', () => {
	// the kernel's options from the manifest's params: compand's curve from its four outputs, expander's range signed by
	// mode, the ducker keyed by its own input, multiband's bands one setting at low and high; numbers as a host delivers
	// them, float32; a manifest with a latency comes out that late, the batch call aligned. The kernels read one channel:
	// link held at 0, and a manifest with a key bus run with none and with one that carries no channels, as a host feeds
	// it when nothing is keyed. softclip has its own test below (its whole call against the stream)
	let same = (x, p, sampleRate, K) => K(x, { ...p, sampleRate })
	const KERNEL = {
		compand: (x, p, sampleRate) => compand(x, { points: [[-90, p.out0], [-60, p.out1], [-20, p.out2], [0, p.out3]], attack: p.attack, release: p.release, sampleRate }),
		compressor: (x, p, sr) => same(x, p, sr, compressor), deesser: (x, p, sr) => same(x, p, sr, deesser),
		ducker: (x, p, sampleRate) => ducker(x, x, { ...p, sampleRate }),
		expander: (x, p, sampleRate) => expander(x, { ...p, range: p.mode === 'upward' ? p.range : -p.range, sampleRate }),
		fet: (x, p, sr) => same(x, p, sr, fet), gate: (x, p, sr) => same(x, p, sr, gate), limiter: (x, p, sr) => same(x, p, sr, limiter),
		multiband: (x, p, sr) => multiband(x.slice(), { fs: sr, freqs: [p.low, p.high], bands: { threshold: p.threshold, ratio: p.ratio, upThreshold: p.upThreshold, upRatio: p.upRatio, depth: p.depth, attack: p.attack, release: p.release, makeup: p.makeup } }),
		opto: (x, p, sr) => same(x, p, sr, opto), unlimit: (x, p, sr) => same(x, p, sr, unlimit), varimu: (x, p, sr) => same(x, p, sr, varimu), vca: (x, p, sr) => same(x, p, sr, vca),
		transientShaper: (x, p, sr) => transientShaper(x.slice(), { attackGain: p.attackGain, sustainGain: p.sustainGain, fs: sr }),
	}
	let r = 11, rnd = () => (r = (Math.imul(r, 1664525) + 1013904223) >>> 0) / 4294967296
	let pick = s => s.type === 'enum' ? s.values[Math.floor(rnd() * s.values.length)] : s.type === 'bool' ? rnd() < 0.5 : Math.fround(s.min > 0 && rnd() < 0.5 ? s.min * (s.max / s.min) ** rnd() : s.min + (s.max - s.min) * rnd())
	for (let [name, m] of Object.entries(ATOMS)) {
		if (!KERNEL[name]) continue
		let differ = 0, runs = 0, keyed = Array.isArray(m.channels?.inputs) && m.channels.inputs.length > 1
		for (let [t, sampleRate] of [22050, 44100, 96000].entries()) {
			let p = Object.fromEntries(Object.entries(m.params).map(([k, s]) => [k, t ? pick(s) : s.type === 'number' ? Math.fround(s.default) : s.default])), n = sampleRate >> 2
			if ('link' in p) p.link = 0
			let x = name === 'unlimit' ? [thuds(n), thuds(n, 1)] : [steps(n, 0, sampleRate), steps(n, 1, sampleRate)]
			let L = typeof m.latency === 'function' ? m.latency({ sampleRate, params: paramsOf(m, p) }) : 0, want = x.map(c => KERNEL[name](c, p, sampleRate))
			for (let block of [1, 100, 1024]) for (let key of keyed ? [undefined, []] : [undefined]) {
				let y = atomRun(m, x, { params: p, block, sampleRate, key })
				runs++
				for (let c = 0; c < 2; c++) for (let i = 0; i + L < n; i++) if (!Object.is(y[c][i + L], want[c][i])) { differ++; break }
			}
		}
		is(differ, 0, `${name}: ${runs} renders, 2 channels each, as the kernel's batch call`)
	}
})

test('limiter manifest: a ceiling lowered mid-signal holds every sample that enters after it', () => {
	let n = fs / 2, at = fs / 4, x = [sine(500, n, 0.9), sine(700, n, 0.9)], L = limiterAtom.latency({ sampleRate: fs, params: paramsOf(limiterAtom) })
	for (let truePeak of [false, true]) {
		let y = atomRun(limiterAtom, x, { params: { ceiling: -1, truePeak }, change: { at, params: { ceiling: -12 } } })
		if (truePeak) L = limiterAtom.latency({ sampleRate: fs, params: paramsOf(limiterAtom, { truePeak }) })
		ok(peak(y[0].subarray(L, at)) <= 10 ** (-1 / 20) + 1e-6 && peak(y[0].subarray(at, at + L)) > 10 ** (-12 / 20), `truePeak ${truePeak}: -1 dB until the change and through the line`)
		ok(Math.max(peak(y[0].subarray(at + L)), peak(y[1].subarray(at + L))) <= 10 ** (-12 / 20) + 1e-6, `truePeak ${truePeak}: -12 dB from what entered after it`)
	}
})

test('deesser manifest: declares its tail, the band\'s 1.5 ms past the delayed sample; a burst is 60 dB down within latency + tail', () => {
	// as @audio/compile's validator measures it (tools/verify.js, tail): Gaussian noise (σ 0.15) for 0.25 s, then
	// silence; from latency + tail on, every 64-frame window's RMS at most 1e-3 of the burst's. Broadband only turns the
	// delayed input down: no tail
	let r = 999, u = () => (r = (Math.imul(r, 1664525) + 1013904223) >>> 0) / 4294967296
	for (let sampleRate of [44100, 96000]) for (let mode of ['split', 'band', 'broadband']) {
		let params = paramsOf(deesserAtom, { mode }), T = deesserAtom.tail({ sampleRate, params }), L = deesserAtom.latency({ sampleRate, params })
		is(T, mode === 'broadband' ? 0 : Math.round(0.0015 * sampleRate) / sampleRate, `${mode} at ${sampleRate} Hz: tail ${(T * 1000).toFixed(3)} ms`)
		let B = sampleRate / 4, n = B + L + Math.ceil(T * sampleRate) + sampleRate / 4
		let x = Float32Array.from({ length: n }, (_, i) => i < B ? 0.15 * Math.sqrt(-2 * Math.log(1 - u())) * Math.cos(2 * Math.PI * u()) : 0)
		let y = atomRun(deesserAtom, [x], { params: { mode }, sampleRate })[0], floor = rmsOf(x, 0, B) * 1e-3, end = B + L + Math.ceil(T * sampleRate), loud = 0
		for (let i = end; i + 64 <= n; i += 64) loud = Math.max(loud, rmsOf(y, i, i + 64))
		ok(loud <= floor, `${mode} at ${sampleRate} Hz: ${db(loud / floor * 1e-3).toFixed(1)} dB under the burst from latency + tail on`)
		if (T) ok(rmsOf(y, B + L, end) > floor, `${mode} at ${sampleRate} Hz: still sounding over the tail it declares`)
	}
})

test('deesser: its detector\'s sections are @audio/biquad\'s highpass and lowpass, coefficient for coefficient; its band the windowed sincs', () => {
	// set.k: the band's sections from 7 (two high-passes at its low edge lo, Q 0.5412 and 1.3066: 4th-order Butterworth)
	// and the body's low-pass from 17 (Q 1/√2, at min(3500 Hz, lo)), b0 b1 b2 a1 a2 each; set.h the 2M + 1 taps, a direct
	// computation of the band: Kaiser-windowed (β 6) sincs at hi less at lo, each scaled by its sum
	let i0 = x => { let s = 1, t = 1; for (let k = 1; k < 32; k++) { t *= (x / 2 / k) ** 2; s += t } return s }, bad = 0, tuned = 0
	for (let sr of [8000, 44100, 48000, 96000]) for (let mode of ['split', 'band', 'broadband']) for (let split of [1000, 3500, 7000, 16000]) for (let fc of [2000, 6500, 15000]) for (let Q of [0.3, 1.4, 10]) {
		let set = deesserSet(sr), k = set.k, top = 0.45 * sr, bw = 2 * Math.asinh(1 / (2 * Q)) / Math.LN2
		deesserBand(set, mode, Float64Array.of(split, fc, Q))
		let lo = mode === 'band' ? Math.min(fc, top) * 2 ** (-bw / 2) : Math.min(split, top), hi = mode === 'band' ? Math.min(top, Math.min(fc, top) * 2 ** (bw / 2)) : top
		let want = [highpass(lo, 0.5412, sr), highpass(lo, 1.3066, sr), lowpass(Math.min(3500, lo), Math.SQRT1_2, sr)]
		want.forEach((c, j) => ['b0', 'b1', 'b2', 'a1', 'a2'].forEach((key, e) => { if (!Object.is(k[7 + 5 * j + e], c[key])) bad++ }))
		let M = Math.round(0.0015 * sr), w = j => i0(6 * Math.sqrt(1 - (j / M) ** 2)) / i0(6), sinc = (f, j) => j ? Math.sin(2 * Math.PI * f / sr * j) / (Math.PI * j) : 2 * f / sr
		let wide = hi >= 0.45 * sr, sl = 0, sh = 0
		for (let j = -M; j <= M; j++) sl += sinc(lo, j) * w(j), sh += wide ? 0 : sinc(hi, j) * w(j)
		for (let j = -M; j <= M; j++) if (!Object.is(set.h[j + M], (wide ? (j ? 0 : 1) : sinc(hi, j) * w(j) / sh) - sinc(lo, j) * w(j) / sl)) bad++
		tuned++
	}
	is(bad, 0, `${tuned} tunings: 15 coefficients and the band's taps each, the same numbers`)
})

// the gain each sample of `x` took: out over in, the output `L` samples late, where the input is not near 0
const gains = (x, y, L = 0) => Float64Array.from(x, (v, i) => Math.abs(v) > 1e-4 && i + L < y.length ? y[i + L] / v : NaN)

test('manifests: link 1 gives every channel one gain; a side 12 dB down stays 12 dB down, sample for sample; link 0 lets it move', () => {
	// The left the steps through every threshold, the right the same a quarter as loud (an exact float32 scaling): one gain
	// on both makes the right's output a quarter of the left's at every sample, bit for bit (a gain on both rounds alike).
	// Two channels of their own (200 and 250 Hz): their gains, out over in, the same within the output's float32 rounding
	// (2 · 2^-24 of each). The limiter's ceiling is set under the left's peaks; the others' defaults cross both sides
	let n = fs / 2, l = steps(n), x = [l, l.map(v => v / 4)], own = [steps(n), steps(n, 1)]
	const BASE = { limiter: { ceiling: -12 } }
	for (let name of ['compressor', 'expander', 'fet', 'gate', 'limiter', 'opto', 'vca']) {
		let m = ATOMS[name], base = BASE[name] ?? {}, L = typeof m.latency === 'function' ? m.latency({ sampleRate: fs, params: paramsOf(m, base) }) : 0
		let y1 = atomRun(m, x, { params: { ...base, link: 1 } }), y0 = atomRun(m, x, { params: base }), off = 0, moved = 0
		for (let i = 0; i < n; i++) if (!Object.is(y1[1][i], y1[0][i] / 4)) off++
		let g0 = gains(x[0], y0[0], L), g1 = gains(x[1], y0[1], L)
		for (let i = 0; i < n; i++) if (Math.abs(db(g1[i]) - db(g0[i])) > 1) moved++
		is(off, 0, `${name}, link 1: the quiet side a quarter of the loud one at every sample`)
		ok(moved > 0, `${name}, link 0: each side by its own level, ${moved} samples where their gains part by over 1 dB`)
		let y = atomRun(m, own, { params: { ...base, link: 1 } }), a = gains(own[0], y[0], L), b = gains(own[1], y[1], L), apart = 0
		for (let i = 0; i < n; i++) if (Math.abs(a[i] - b[i]) > 2 * 2 ** -24 * (Math.abs(a[i]) + Math.abs(b[i]))) apart++
		is(apart, 0, `${name}, link 1: two channels of their own take one gain curve`)
	}
})

test('manifests: a key bus feeds the detector: a loud key turns the input down, a silent one closes a gate; a mono key serves every channel; a key bus with no channels is no key', () => {
	// compressors and the ducker: an input at −40 dB, under every threshold, untouched alone, at least 6 dB down under a
	// key at −1 dB. The gate and the expander: an input at −20 dB, over their thresholds, open alone, at least 30 dB down
	// under a silent key (the gate's range −60 dB, the expander's 40 dB). Over the second half, the gain settled
	let n = fs / 2, h = n / 2, loud = sine(2000, n, 0.9), silent = new Float32Array(n)
	let change = (x, y) => Math.max(...x.map((c, j) => Math.abs(db(rmsOf(y[j], h) / rmsOf(c, h)))))
	let down = (x, y) => Math.min(...x.map((c, j) => db(rmsOf(c, h) / rmsOf(y[j], h))))
	for (let [names, x, key] of [[['compressor', 'ducker', 'fet', 'opto', 'vca'], [sine(300, n, 0.01), sine(450, n, 0.01)], loud], [['expander', 'gate'], [sine(300, n, 0.1), sine(450, n, 0.1)], silent]]) for (let name of names) {
		let m = ATOMS[name], alone = atomRun(m, x), none = atomRun(m, x, { key: [] }), mono = atomRun(m, x, { key: [key] }), both = atomRun(m, x, { key: [key, key] })
		ok(change(x, alone) < 0.05, `${name}: alone, ${change(x, alone).toFixed(3)} dB from its input`)
		ok(down(x, mono) >= (key === loud ? 6 : 30), `${name}: keyed, ${down(x, mono).toFixed(1)} dB down`)
		ok(none.every((c, j) => c.every((v, i) => Object.is(v, alone[j][i]))), `${name}: a key bus with no channels is no key, bit for bit`)
		ok(both.every((c, j) => c.every((v, i) => Object.is(v, mono[j][i]))), `${name}: a mono key serves both channels, as the same key on each`)
		// a list of buses takes @audio/compile's validator's channel check off them (it runs a bare 'any' only): 1, 6 and
		// 10 channels here, alone and keyed by one, linked halfway, as many out and finite
		for (let k of [1, 6, 10]) for (let keyBus of [undefined, [key]]) {
			let y = atomRun(m, Array.from({ length: k }, (_, c) => x[c % 2]), { key: keyBus, params: { link: 0.5 } })
			ok(y.length === k && y.every(c => c.every(Number.isFinite)), `${name}: ${k} channels${keyBus ? ', a mono key' : ''}`)
		}
	}
})

test('multiband: the bands add up to the crossovers\' allpass when nothing compresses; its magnitude is the input\'s', () => {
	// A Linkwitz-Riley pair's two outputs add to an allpass, AP = LP + HP (Linkwitz & Riley 1976, JAES 24(1)), so three
	// bands built as multiband.js builds them add to AP(low)·AP(high): computed here directly, @audio/eq-crossover's own
	// pairs run in doubles through @audio/biquad's step and summed. Ratio 1 compresses nothing (gain 0 dB, the upward
	// curve off). Within 1e-6 of the peak: a band is float32 after each of its sections (as it was), each rounding within
	// 2^-24 of its value, at most 4 sections and 3 bands, and the output rounded once more, under 16 · 2^-24 ≈ 1e-6 with
	// the filters' gains near 1. Then the impulse response's magnitude, 300 frequencies from 20 Hz to 0.45·fs: flat within
	// 1e-5 dB. The bands as eq-crossover alone splits them summed to LP + HP·LP + HP: 0.12 dB down at 1.5 kHz with
	// crossovers at 200 and 2000 Hz, 2.5 dB at 1000 and 1000. Then the kernel at every order it takes (LR2, LR4, LR8) and
	// 2 to 5 bands: the bands add to the product of every crossover's allpass, within (S·B + 1)·2^-24·√2 of the peak, S
	// the most sections a band runs, B the bands (each rounding of a value a Butterworth section of Q 1.31 may lift 3 dB)
	let ap = (x, f, sr, order = 4) => {
		let [lo, hi] = crossover([f], order, sr), a = Float64Array.from(x), b = Float64Array.from(x)
		for (let s of lo) { let z = state(); for (let i = 0; i < a.length; i++) a[i] = step(s, z, a[i]) }
		for (let s of hi) { let z = state(); for (let i = 0; i < b.length; i++) b[i] = step(s, z, b[i]) }
		return a.map((v, i) => v + b[i])
	}
	let mag = (h, f, sr) => { let re = 0, im = 0, w = 2 * Math.PI * f / sr; for (let i = 0; i < h.length; i++) { re += h[i] * Math.cos(w * i); im -= h[i] * Math.sin(w * i) } return 10 * Math.log10(re * re + im * im) }
	let r = 9, u = () => (r = (Math.imul(r, 1664525) + 1013904223) >>> 0) / 2147483648 - 1
	for (let sr of [44100, 96000]) for (let [lo, hi] of [[200, 2000], [40, 1000], [1000, 1000], [500, 1500], [1000, 12000]]) {
		let n = 8192, x = Float32Array.from({ length: n }, (_, i) => i < n / 2 ? 0.5 * u() : 0), ref = ap(ap(x, lo, sr), hi, sr), top = peak(ref)
		let k = multiband(x.slice(), { fs: sr, freqs: [lo, hi], bands: { ratio: 1 } }), a = atomRun(multibandAtom, [x], { params: { low: lo, high: hi, ratio: 1 }, sampleRate: sr })[0]
		let dk = 0, da = 0
		for (let i = 0; i < n; i++) { dk = Math.max(dk, Math.abs(k[i] - ref[i])); da = Math.max(da, Math.abs(a[i] - ref[i])) }
		ok(dk <= 1e-6 * top && da <= 1e-6 * top, `${lo} and ${hi} Hz at ${sr}: kernel ${(dk / top).toExponential(1)}, manifest ${(da / top).toExponential(1)} of the peak from AP·AP`)
		let imp = new Float32Array(16384); imp[0] = 1
		let hr = multiband(imp, { fs: sr, freqs: [lo, hi], bands: { ratio: 1 } }), worst = 0
		for (let j = 0; j < 300; j++) { let v = mag(hr, 20 * (0.45 * sr / 20) ** (j / 299), sr); if (Math.abs(v) > Math.abs(worst)) worst = v }
		ok(Math.abs(worst) <= 1e-5, `${lo} and ${hi} Hz at ${sr}: magnitude flat within ${Math.abs(worst).toExponential(1)} dB`)
	}
	for (let sr of [44100, 96000]) for (let order of [2, 4, 8]) for (let freqs of [[700], [150, 3000], [150, 700, 3000], [100, 400, 1600, 6400]]) {
		let n = 8192, x = Float32Array.from({ length: n }, (_, i) => i < n / 2 ? 0.5 * u() : 0), ref = Float64Array.from(x)
		for (let f of freqs) ref = ap(ref, f, sr, order)
		let top = peak(ref), k = multiband(x.slice(), { fs: sr, freqs, order, bands: { ratio: 1 } }), dk = 0
		for (let i = 0; i < n; i++) dk = Math.max(dk, Math.abs(k[i] - ref[i]))
		let [lp, hp] = crossover([1000], order, sr), B = freqs.length + 1, S = 0
		for (let b = 0; b < B; b++) S = Math.max(S, b * hp.length + (b < B - 1 ? lp.length : 0) + (B - 2 - b > 0 ? (B - 2 - b) * lp.length / 2 : 0))
		ok(dk <= (S * B + 1) * 2 ** -24 * Math.SQRT2 * top, `LR${order}, ${B} bands at ${sr}: ${(dk / top / 2 ** -24).toFixed(1)}·2^-24 of the peak from the allpasses' product (≤ ${((S * B + 1) * Math.SQRT2).toFixed(0)})`)
		let imp = new Float32Array(16384); imp[0] = 1
		let hr = multiband(imp, { fs: sr, freqs, order, bands: { ratio: 1 } }), worst = 0
		for (let j = 0; j < 300; j++) { let v = mag(hr, 20 * (0.45 * sr / 20) ** (j / 299), sr); if (Math.abs(v) > Math.abs(worst)) worst = v }
		ok(Math.abs(worst) <= 1e-5, `LR${order}, ${B} bands at ${sr}: magnitude flat within ${Math.abs(worst).toExponential(1)} dB`)
	}
})

test('multiband: its crossovers in place (split3) are @audio/eq-crossover\'s, coefficient for coefficient', () => {
	// split3 writes the sections the manifest recomputes when low or high moves without allocating: they must be the
	// numbers multiband() takes from eq-crossover at order 4 (LR4: its Butterworth section twice), the allpass from the
	// low-pass section's denominator; cutoffs at 0 and from Nyquist up held at silence or a pass, as eq-crossover holds them
	let co = new Float64Array(55), bad = 0, tuned = 0, r = 17, u = () => (r = (Math.imul(r, 1664525) + 1013904223) >>> 0) / 4294967296
	let ap = s => s.b1 === 0 && s.b2 === 0 && s.a1 === 0 && s.a2 === 0 ? { b0: 1, b1: 0, b2: 0, a1: 0, a2: 0 } : { b0: s.a2, b1: s.a1, b2: 1, a1: s.a1, a2: s.a2 }
	for (let sr of [8000, 22050, 44100, 48000, 96000, 192000]) for (let i = 0; i < 200; i++) {
		let lo = i === 0 ? 0 : i === 1 ? sr / 2 : sr * u() ** 3, hi = i === 2 ? sr : sr * u() ** 2
		split3(co, Float64Array.of(lo, hi, sr))
		let [L1, H1] = crossover([lo], 4, sr), [L2, H2] = crossover([hi], 4, sr)
		;[L1[0], L1[1], ap(L2[0]), H1[0], H1[1], L2[0], L2[1], H1[0], H1[1], H2[0], H2[1]].forEach((s, j) => ['b0', 'b1', 'b2', 'a1', 'a2'].forEach((key, e) => { if (!Object.is(co[5 * j + e], s[key])) bad++ }))
		tuned++
	}
	is(bad, 0, `${tuned} tunings, 55 coefficients each`)
})

test('multiband manifest: declares its tail from its low crossover; a burst is 60 dB under the input within it', () => {
	// as @audio/compile's validator measures a tail (tools/verify.js): Gaussian noise (σ 0.15) for 0.25 s, then silence;
	// from the declared tail on, every 64-frame window's RMS at most 1e-3 of the burst's. The slowest crossover (40 Hz),
	// alone and with all the gain the bands may put on the ring (makeup 24 dB, the upward lift 12 dB times depth 2); at
	// the defaults the declaration is no gross overstatement: the ring is still over that floor past a fifth of it. It is a
	// bound from the poles, and the ring noise leaves starts under it: measured, at most 0.80 of it (8 seeds, 6 settings
	// from these to low 100 and high 5000 Hz, 44.1 and 96 kHz)
	let r = 999, u = () => (r = (Math.imul(r, 1664525) + 1013904223) >>> 0) / 4294967296
	for (let sampleRate of [44100, 96000]) for (let set of [{}, { low: 40 }, { low: 40, makeup: 24, upRatio: 20, depth: 2 }, { low: 40, makeup: 24, upRatio: 20, depth: 2, threshold: -60, ratio: 20, release: 20 }]) {
		let T = multibandAtom.tail({ sampleRate, params: paramsOf(multibandAtom, set) }), B = sampleRate / 4, n = B + Math.ceil(T * sampleRate) + sampleRate / 4
		let x = Float32Array.from({ length: n }, (_, i) => i < B ? 0.15 * Math.sqrt(-2 * Math.log(1 - u())) * Math.cos(2 * Math.PI * u()) : 0)
		let y = atomRun(multibandAtom, [x], { params: set, sampleRate })[0], floor = rmsOf(x, 0, B) * 1e-3, end = B + Math.ceil(T * sampleRate), loud = 0
		for (let i = end; i + 64 <= n; i += 64) loud = Math.max(loud, rmsOf(y, i, i + 64))
		ok(loud <= floor, `${JSON.stringify(set)} at ${sampleRate}: tail ${(T * 1000).toFixed(1)} ms, then ${db(loud / floor * 1e-3).toFixed(1)} dB under the burst`)
		let late = 0
		for (let i = B + Math.round(0.2 * T * sampleRate); i + 64 <= end; i += 64) late = Math.max(late, rmsOf(y, i, i + 64))
		if (!set.makeup) ok(late > floor, `${JSON.stringify(set)} at ${sampleRate}: still ringing past a fifth of it`)
	}
})

test('softclip manifest: streams; oversampled, it is the whole call on the signal padded with silence, `latency` samples late', () => {
	// The whole call reads its kernels over the signal alone and divides one its edges cut short by what is left of it;
	// with silence past the kernels' reach on either side it reads every kernel whole, as the stream does from its first
	// sample: bit for bit at every N, as @audio/resample-sinc's resampler steps each point's phase in whole numbers. The
	// whole call on the signal as it is differs only within the kernels' reach of an end: the oversampler's ring from the
	// start, its latency from the end
	let r = 3, u = () => (r = (Math.imul(r, 1664525) + 1013904223) >>> 0) / 4294967296
	for (let N = 1; N <= 8; N++) for (let [t, curve] of ['tanh', 'atan', 'cubic', 'sin', 'hard'].entries()) {
		let sampleRate = [22050, 44100, 48000, 96000, 44100][t], n = 3000, P = 64, drive = Math.fround(0.1 + 19.9 * u() ** 2), ceiling = Math.fround(0.05 + 0.95 * u())
		let p = { curve, drive, ceiling, oversample: N }, L = softclipAtom.latency({ sampleRate, params: paramsOf(softclipAtom, p) }), o = N > 1 ? oversampler(N, 0) : null
		let x = Float32Array.from({ length: n }, (_, i) => 0.9 * Math.sin(2 * Math.PI * 3000 * i / sampleRate) * Math.sin(i / 400) + 0.2 * (u() - 0.5))
		let pad = new Float32Array(n + 2 * P), xin = new Float32Array(n + L)
		pad.set(x, P); xin.set(x)
		let want = softclip(pad, { ...p, fs: sampleRate }).subarray(P, P + n), bare = softclip(x, { ...p, fs: sampleRate })
		for (let block of [1, 37, 128]) {
			let y = atomRun(softclipAtom, [xin], { params: p, block, sampleRate })[0].subarray(L), edge = 0
			for (let i = 0; i < n; i++) if (y[i] !== bare[i]) edge = Math.max(edge, Math.min(i, n - 1 - i) + 1)
			ok(y.every((v, i) => Object.is(v, want[i])), `oversample ${N}, ${curve}, blocks of ${block}: the padded whole call, bit for bit`)
			ok(edge <= (o ? Math.max(o.ring, o.latency) : 0), `oversample ${N}, ${curve}: the whole call as it is parts only within ${edge} samples of an end`)
		}
	}
})


// --- live values, moved by a host (contract 1.0: Parameters, `smoothing`; What a host owes, 3) ---

// A host as contract 1.0 asks one to be: `params` from the start; at frame `at` the values `to`, each with `smoothing`
// reached by a linear ramp of that many seconds from the value in force, in its own unit (`ramp: false`: a jump); the
// call split at `at`, no call longer than 32 frames while a value moves, each call handed the values at its first frame
// as float32. audio's toStream and its own host, and @audio/compile-wam, hand a call the same. Otherwise calls of
// `block` frames, or of what `cut()` gives (1 to `block`)
function hosted (m, x, { params = {}, at = Infinity, to = {}, block = 128, cut, ramp = true, sampleRate = fs } = {}) {
	let n = x[0].length, live = paramsOf(m, params), out = x.map(() => new Float32Array(n)), len = {}
	let proc = m({ sampleRate, maxBlockSize: block, maxChannels: x.length, params: paramsOf(m, params), buffers: {} })
	for (let p in to) len[p] = ramp && m.params[p].smoothing > 0 ? Math.max(1, Math.round(m.params[p].smoothing * sampleRate)) : 0
	for (let i = 0, k; i < n; i += k) {
		k = Math.min(n - i, cut ? cut() : block)
		if (i < at && i + k > at) k = at - i
		for (let p in to) {
			let s = m.params[p], d = i - at, from = params[p] ?? s.default
			if (d < 0) continue
			if (s.type !== 'number') live[p] = to[p]
			else if (d < len[p]) { live[p] = Float32Array.of(to[p] + (from - to[p]) * (1 - d / len[p])); k = Math.min(k, 32, at + len[p] - i) }
			else live[p] = Float32Array.of(to[p])
		}
		proc([x.map(c => c.subarray(i, i + k))], [out.map(c => c.subarray(i, i + k))], live)
	}
	return out
}
// the largest |second difference| of y over [a, b)
const d2max = (y, a, b) => { let m = 0; for (let i = Math.max(1, a); i < Math.min(y.length - 1, b); i++) m = Math.max(m, Math.abs(y[i + 1] - 2 * y[i] + y[i - 1])); return m }
const peakOf = (y, a, b) => { let m = 0; for (let i = a; i < b; i++) m = Math.max(m, Math.abs(y[i])); return m }
// the largest one-sample step, in dB, of the gain the change adds: 20·log10|b/a|, where |a| is over 1e-3 of its peak
function gainStep (a, b, w0, w1) {
	let m = 0, prev = NaN, floor = 1e-3 * peakOf(a, w0, w1)
	for (let i = w0; i < w1; i++) {
		if (Math.abs(a[i]) < floor) { prev = NaN; continue }
		let g = 20 * Math.log10(Math.abs(b[i] / a[i]))
		if (prev === prev) m = Math.max(m, Math.abs(g - prev))
		prev = g
	}
	return m
}

test('manifests: a value that scales the signal is glided: a host\'s ramp of it is one line of the gain, the same whatever the calls, the value itself after it', () => {
	// A host ramps a jump over the param's `smoothing` (0.02 s: N = 882 frames) in calls of 32 frames; the change on the
	// 128-frame grid and inside a call. The measure (the review's): the largest |second difference| from 4 samples before
	// the change to 4096 after, over the largest of the unchanged render's there and the changed one's 2048 before it.
	// Derived: a gain moved from 1 to r times by a straight line over N samples has two corners. For y = m·a (m the gain's
	// ramp, a the render unchanged), d2(m·a)[n] = m[n]·d2a[n] + (m[n+1] − m[n])·a[n+1] + (m[n−1] − m[n])·a[n−1]: away from
	// a corner the slope terms nearly cancel, at one only one is left, so |d2| ≤ the steady renders' larger d2 + slope ×
	// max|a|. A straight line of a linear gain (softclip's ceiling and drive, the transient shaper's gains: 'lin') has the
	// slope |r − 1|/N. A host ramps a dB value in dB, and the dB gain of a threshold, a range or a curve's point moves with
	// it ('dB'): the gain is an exponential whose steepest slope is max(1, r)·|ln r|/N, max(1, r)·|ln r|/|r − 1| times the
	// line's (1.85 for +12 dB). Margin 1.1: the steady renders' maxima are over a window a follower's ripple moves.
	// No one-sample step of the gain over 0.1 dB: a host's ramp moves 12 to 40 dB over 882 frames, 0.014 to 0.045 dB a
	// frame. Before the glide each was one step of the whole change (12 to 26.5 dB); declaring `smoothing` alone left
	// the host's 32-frame stairs (0.44 to 1.5 dB)
	let n = fs * 3 / 4, N = Math.round(0.02 * fs), r = 5, u = () => (r = (Math.imul(r, 1664525) + 1013904223) >>> 0) / 4294967296
	let tone = (f, A) => Float32Array.from({ length: n }, (_, i) => A * Math.sin(2 * Math.PI * f * i / fs))
	let square = (f, A) => Float32Array.from({ length: n }, (_, i) => Math.sin(2 * Math.PI * f * i / fs) < 0 ? -A : A)
	const ROWS = [
		// processor, settings, signal, the change, the gain's law, the call sizes compared
		['fet', {}, f => tone(f, 0.5), { makeup: 12 }, 'dB', true],
		['multiband', {}, f => tone(f, 0.5), { makeup: 12 }, 'dB'],
		['compand', {}, f => tone(f, 0.7), { out3: -30 }, 'dB', true],
		['expander', {}, f => tone(f, 0.003), { threshold: -20 }, 'dB', true],
		['ducker', { threshold: -40 }, f => tone(f, 0.5), { range: -6 }, 'dB'],
		['gate', {}, f => tone(f, 0.003), { range: -20 }, 'dB', true],
		['unlimit', { ceiling: -6 }, f => square(f, 0.9), { ceiling: -18 }, 'dB'],
		['softclip', {}, f => tone(f, 0.5), { ceiling: 0.25 }, 'lin'],
		['softclip', {}, f => tone(f, 0.01), { drive: 4 }, 'lin', true],
		['transientShaper', {}, f => tone(f, 0.5), { sustainGain: 1 }, 'lin', true],
	]
	for (let [name, base, sig, to, law, sizes] of ROWS) for (let f of [220, 1000]) for (let at of [22016, 22063]) {
		let m = ATOMS[name], x = [sig(f)], k = Object.keys(to)[0], label = `${name}.${k} → ${to[k]}, ${f} Hz, at ${at}`
		is(m.params[k].smoothing, 0.02, `${label}: smoothed`)
		let a = hosted(m, x, { params: base })[0], b = hosted(m, x, { params: base, at, to })[0], c = hosted(m, x, { params: { ...base, ...to } })[0]
		let w0 = at - 4, w1 = at + 4096, ref = Math.max(d2max(a, w0, w1), d2max(b, at - 2048, at - 4)), measure = d2max(b, w0, w1) / ref
		let steady = Math.max(d2max(a, w0, w1), d2max(c, w0, w1)) / ref, g = rmsOf(c, at + 8192) / rmsOf(a, at + 8192)
		let slope = law === 'dB' ? Math.max(1, g) * Math.abs(Math.log(g)) : Math.abs(g - 1), bound = 1.1 * (steady + slope * peakOf(a, w0, w1) / (N * ref))
		ok(measure <= bound, `${label}: ×${measure.toFixed(2)}, derived ≤ ×${bound.toFixed(2)} (the gain ×${g.toFixed(3)})`)
		let step = gainStep(a, b, w0, w1)
		ok(step <= 0.1, `${label}: the gain moves ${step.toFixed(4)} dB a sample at most`)
		// the value itself after the move (the glide ends 32 frames after the ramp): bit for bit the render at the new
		// value; the gate's once its gain smoother has reached the new closed gain (100 ms: 1000 times its 0.1 ms attack)
		let from = at + N + 32 + (name === 'gate' ? 4410 : 0), off = 0
		for (let i = from; i < n; i++) if (!Object.is(b[i], c[i])) off++
		is(off, 0, `${label}: from ${from - at} frames after the change, the render at ${to[k]}`)
		if (!sizes || at !== 22063 || f !== 220) continue
		// the same samples whatever the host's calls: blocks of 1, 32, 128 and random cuts (32 frames at most while it
		// moves). The glide reads the host's line 32 frames late from the values at the calls' first frames; 1-frame calls
		// give every frame's float32 value, longer ones float32 values 32 frames apart, joined in doubles: the two lines
		// part by one float32 ulp of the value at most (2^-23 of its largest), a gain's relative change of that times
		// ln10/20 a dB ('dB'), or that ('lin'), and each render rounds once to float32: within Ymax·(rel + 2^-23)
		let ys = [1, 32, 128].map(block => hosted(m, x, { params: base, at, to, block })[0]).concat([hosted(m, x, { params: base, at, to, block: 128, cut: () => 1 + Math.floor(u() * 128) })[0]])
		let V = Math.max(Math.abs(base[k] ?? m.params[k].default), Math.abs(to[k])), rel = law === 'dB' ? 2 ** -23 * V * Math.LN10 / 20 : 2 ** -23
		let Y = peakOf(ys[0], 0, n), tol = Y * (rel + 2 ** -23)
		for (let j = 1; j < ys.length; j++) {
			let far = 0
			for (let i = 0; i < n; i++) far = Math.max(far, Math.abs(ys[j][i] - ys[0][i]))
			ok(far <= tol, `${label}: ${['', 'blocks of 32', 'blocks of 128', 'random calls'][j]}: within ${far.toExponential(2)} of 1-frame calls (≤ ${tol.toExponential(2)})`)
		}
	}
	// behind a follower: opto's threshold −20 → −40 dB on a tone at −9.0 dB RMS moves the static curve's target (ratio 3,
	// knee 10 dB) from −7.33 to −20.67 dB; the gain reduction follows it at the attack, so no sample moves the gain more
	// than (1 − e^(−1/(τ·fs)))·|Δtarget|, τ = 10 ms: 0.030 dB. Margin 1.1: the RMS window (256 samples, 1.3 cycles of
	// 220 Hz) ripples the level, and the target with it. A jump, as threshold has no smoothing: it needs none
	let L = db(0.5 / Math.SQRT2), dt = Math.abs(compressorGain(L, -40, 3, 10) - compressorGain(L, -20, 3, 10)), most = (1 - Math.exp(-1 / (0.01 * fs))) * dt
	for (let f of [220, 1000]) {
		let x = [tone(f, 0.5)], a = hosted(optoAtom, x)[0], b = hosted(optoAtom, x, { at: 22016, to: { threshold: -40 } })[0], step = gainStep(a, b, 22012, 26112)
		ok(step > 0.5 * most && step <= 1.1 * most, `opto.threshold → −40, ${f} Hz: the gain moves ${step.toFixed(4)} dB a sample, its attack lets ${most.toFixed(4)}`)
	}
})

test('manifests: a second ramp plays its own line: no slot of an earlier one is read, whatever call follows a ramp or opens the next', () => {
	// A host splits a block where a value jumps and calls with 32 frames at most while it moves (contract 1.0, What a
	// host owes, 3), so a ramp's first call is as short as what is left of the block, and the call after a ramp as long
	// as the block: CLAP's blocks and audio's chunks are any length. Here makeup ramps 0 → 12 dB, is held through a call
	// of 100 frames and blocks of 128, then ramps back from a frame 7 before a block's end. util.js glide plays the line
	// through the values at the calls' first frames 32 frames late: from one call's value to the next's straight, or after
	// a call over 32 frames held to 32 frames before the next and straight from there. makeup is a pure gain in these
	// five (no detector reads it: the gain is db2lin(reduction + makeup)), so 20·log10(y/y at 0 dB) is the line itself,
	// within the two float32 roundings of y, 20/ln10·2·2^-24 dB, and the double arithmetic's, under 2^-40. Read from
	// slots the first ramp left, it was off by 0.37 dB
	let N = Math.round(0.02 * fs), calls = []
	let hold = (frames, v) => { for (let d = 0; d < frames;) { let k = Math.min(128, frames - d); calls.push([k, v]); d += k } }
	let ramp = (from, to, first) => { for (let d = 0, k = first; d < N; d += k, k = 32) { k = Math.min(k, N - d); calls.push([k, Math.fround(to + (from - to) * (1 - d / N))]) } }
	hold(1024, 0); ramp(0, 12, 32); calls.push([100, 12]); hold(2000, 12); ramp(12, 0, 7); hold(2000, 0)
	let n = calls.reduce((s, c) => s + c[0], 0), starts = [], x = sine(1000, n, 0.5)
	for (let c = 0, at = 0; c < calls.length; at += calls[c++][0]) starts.push(at)
	let line = t => {
		let c = 0
		while (c + 1 < calls.length && starts[c + 1] <= t) c++
		if (t < 0 || c + 1 === calls.length) return calls[c][1]
		let [f, v] = calls[c], w = calls[c + 1][1], e = starts[c + 1], L = f < 32 ? f : 32
		return t < e - L ? v : v + (w - v) * (t - (e - L)) / L
	}
	for (let name of ['compressor', 'fet', 'opto', 'varimu', 'vca']) {
		let m = ATOMS[name], run = moved => {
			let proc = m({ sampleRate: fs, maxBlockSize: 128, maxChannels: 1, params: paramsOf(m), buffers: {} }), live = paramsOf(m), y = new Float32Array(n)
			for (let c = 0; c < calls.length; c++) { live.makeup = Float32Array.of(moved ? calls[c][1] : 0); proc([[x.subarray(starts[c], starts[c] + calls[c][0])]], [[y.subarray(starts[c], starts[c] + calls[c][0])]], live) }
			return y
		}
		let still = run(false), y = run(true), off = 0, tol = 20 / Math.LN10 * 2 * 2 ** -24 + 2 ** -40
		for (let i = 0; i < n; i++) if (still[i]) off = Math.max(off, Math.abs(20 * Math.log10(Math.abs(y[i] / still[i])) - line(i - 32)))
		ok(off <= tol, `${name}.makeup, two ramps: the gain off its line by ${off.toExponential(2)} dB at most (≤ ${tol.toExponential(2)})`)
	}
})

test('multiband manifest: low and high are smoothed: a host retunes the crossovers along its ramp, a small step a call', () => {
	// A running IIR whose coefficients change leaves a transient as large as the change, to first order. A host's ramp
	// over N = 882 frames makes ⌈N/32⌉ changes in place of one; the largest is `share` of the whole (computed here from
	// split3 at the values the calls bring), and each rings for the slowest pole's decay, τ = −1/ln r samples (r = √a2 of
	// the lowest crossover's section, as tail() reads it), so the transients of calls 32 frames apart add up to at most
	// 1/(1 − e^(−32/τ)) of one. The ramped render's measure over 1 is then at most the jump's × share × that overlap.
	// A jump of `low` 200 → 1000 Hz measured ×419 at 220 Hz (the review), a ramp of it ×14
	let n = fs * 3 / 4, at = 22016, N = Math.round(0.02 * fs)
	for (let [k, from, to] of [['low', 200, 1000], ['high', 2000, 8000]]) for (let f of [220, 1000]) {
		let x = [Float32Array.from({ length: n }, (_, i) => 0.5 * Math.sin(2 * Math.PI * f * i / fs))], label = `${k} ${from} → ${to} Hz, ${f} Hz`
		is(multibandAtom.params[k].smoothing, 0.02, `${label}: smoothed`)
		let a = hosted(multibandAtom, x)[0], ref = d2max(a, at - 4, at + 4096)
		let measure = y => Math.max(d2max(y, at - 4, at + 4096) / ref, 1)
		let jump = measure(hosted(multibandAtom, x, { at, to: { [k]: to }, ramp: false })[0]), ramped = measure(hosted(multibandAtom, x, { at, to: { [k]: to } })[0])
		let co = v => split3(new Float64Array(55), Float64Array.of(k === 'low' ? Math.fround(v) : 200, k === 'high' ? Math.fround(v) : 2000, fs))
		let S = Math.ceil(N / 32), first = co(from), last = co(to), whole = 0, most = 0
		for (let e = 0; e < 55; e++) whole = Math.max(whole, Math.abs(last[e] - first[e]))
		for (let s = 1, was = first; s <= S; s++) {
			let now = co(to + (from - to) * (1 - Math.min(N, 32 * s) / N))
			for (let e = 0; e < 55; e++) most = Math.max(most, Math.abs(now[e] - was[e]))
			was = now
		}
		let tau = -1 / Math.log(Math.sqrt(co(200)[4])), bound = 1 + (jump - 1) * (most / whole) / (1 - Math.exp(-32 / tau))
		ok(ramped <= bound, `${label}: a jump ×${jump.toFixed(1)}, the ramp ×${ramped.toFixed(1)}, derived ≤ ×${bound.toFixed(1)}`)
	}
})

test('manifests: each live number is glided, behind a follower, a filter\'s retune or a count; the glided ones smoothed over 20 ms', () => {
	// glided: it scales the signal with nothing behind it, so its jump was a step of the gain (the test above); behind a
	// follower: its change reaches the gain through a smoother whose state is kept (attack, release, a gain reduction's
	// smoother, the limiter's line); a retune: a filter's coefficients, its state kept; a count: whole samples. One time
	// for the family's glided values, 20 ms: makeup's 36 dB (−12 to 24) then moves at most 36/882 = 0.041 dB a sample at
	// 44.1 kHz and 0.082 at 22.05 kHz; the widest, the 90 dB of compand's output levels and of the gate's, the ducker's
	// and the expander's range, 0.10 and 0.20, a straight ramp; and it is the smoothing of the effect family's glided
	// delay reads. The leveler takes the whole take in one call: none moves
	const CLASS = {
		glided: { compand: 'out0 out1 out2 out3', compressor: 'makeup', ducker: 'threshold ratio knee range', expander: 'threshold ratio knee range link', fet: 'makeup', gate: 'range', multiband: 'threshold ratio upThreshold upRatio depth makeup', opto: 'makeup', softclip: 'drive ceiling', transientShaper: 'attackGain sustainGain', unlimit: 'ceiling', varimu: 'makeup', vca: 'makeup' },
		follower: { compand: 'attack release', compressor: 'threshold ratio knee upThreshold upRatio upKnee upRange attack release link', deesser: 'threshold ratio range knee attack release', ducker: 'attack release', expander: 'attack release', fet: 'threshold ratio knee attack release link', gate: 'threshold closeThreshold attack release link', limiter: 'ceiling release link', multiband: 'attack release', opto: 'threshold ratio knee attack link', unlimit: 'amount drive crestTarget fastAttack fastRelease slowAttack slowRelease', varimu: 'threshold knee attack release', vca: 'threshold ratio knee attack release link' },
		retune: { deesser: 'split fc Q', multiband: 'low high' },
		count: { gate: 'hold' },
	}
	is(levelerAtom.streaming, false, 'leveler: the whole take in one call')
	for (let [name, m] of Object.entries(ATOMS)) for (let [k, s] of Object.entries(m.params)) {
		if (s.type !== 'number' || restart(s)) continue
		let in_ = Object.keys(CLASS).filter(c => CLASS[c][name]?.split(' ').includes(k))
		is(in_.length, 1, `${name}.${k}: in one class (${in_.join(', ') || 'none'})`)
		if (in_[0] === 'glided' || name === 'multiband' && in_[0] === 'retune') is(s.smoothing, 0.02, `${name}.${k}: smoothed over 20 ms`)
	}
})

test('manifests: a block allocates nothing, at any setting, moving or held', () => {
	// measured as @audio/compile's validator measures it (tools/verify.js, alloc): a child Node with a 1 MB young
	// generation, process() called directly with buffers made once, 2^17 warm blocks of 8 frames at 48 kHz, stereo, and no
	// collection allowed. Each instance (and one per value of a restart param: the gate's and the limiter's lookahead
	// lines, the true-peak reader) warmed on silence (an idle plugin), then on thuds through every setting (the defaults,
	// each number a quarter and two thirds up its range off any integer, each enum and bool value), then held at each and
	// moved between two each call (every coefficient recomputed every call); a processor with a key bus fed a key, then
	// held at each setting with a key bus that carries no channels. Moved between two settings each call, every glided
	// value moves every call (util.js glide: its ring, the line read 32 frames late, a dB value's gain per sample)
	let code = `
		import { PerformanceObserver } from 'node:perf_hooks'
		let out = {}
		for (let [name, builds] of ${JSON.stringify(Object.entries({ compand: [{}], compressor: [{}], deesser: [{}], ducker: [{}], expander: [{}], fet: [{}], gate: [{}, { lookahead: 5 }], limiter: [{}, { truePeak: true }], multiband: [{}], opto: [{}], softclip: [{}, { oversample: 3 }, { oversample: 8 }], 'transient-shaper': [{}], unlimit: [{}], varimu: [{}], vca: [{}] }))}) {
			let m = Object.values(await import('@audio/dynamics-' + name + '/audio')).find(v => typeof v === 'function' && v.params), specs = Object.entries(m.params)
			let num = (s, f) => Float32Array.of(Math.min(s.max, s.min + (s.max - s.min) * f + (s.max - s.min > 1 ? 0.37 : 0)))
			let base = f => Object.fromEntries(specs.map(([k, s]) => [k, s.type === 'number' ? (f == null ? Float32Array.of(s.default) : num(s, f)) : s.default]))
			let sets = [base(), base(0.25), base(0.66)]
			for (let [k, s] of specs) if (s.restart !== true && s.type !== 'number') for (let v of s.type === 'bool' ? [true, false] : s.values) { let p = base(0.25); p[k] = v; sets.push(p) }
			let u = 3, n = 48000, B = n / 8, buses = Array.isArray(m.channels?.inputs) ? m.channels.inputs.length : 1
			let thuds = () => Float32Array.from({ length: n }, (_, i) => { let t = (i % 4800) / 48000; return (0.02 + 0.9 * Math.exp(-t * 40)) * Math.sin(2 * Math.PI * 90 * i / 48000 + Math.sin(i)) + 0.01 * ((u = (Math.imul(u, 1664525) + 1013904223) >>> 0) / 2147483648 - 1) })
			let views = src => Array.from({ length: B }, (_, k) => Array.from({ length: buses }, () => src.map(c => c.subarray(k * 8, k * 8 + 8))))
			let loud = views([thuds(), thuds()]), quiet = views([new Float32Array(n), new Float32Array(n)]), O = [[new Float32Array(8), new Float32Array(8)]]
			let bare = buses > 1 ? loud.map(b => [b[0], []]) : null
			let worst = 0
			for (let b of builds) {
				let fix = p => { for (let k in b) p[k] = typeof b[k] === 'number' ? Float32Array.of(b[k]) : b[k]; return p }
				sets.forEach(fix)
				let proc = m({ sampleRate: 48000, maxBlockSize: 128, maxChannels: 2, params: sets[0], buffers: {} })
				let run = (ins, k, P, Q = P) => { for (let i = 0; i < k; i++) proc(ins[i % B], O, i & 1 ? Q : P) }
				run(quiet, 1 << 15, sets[0])
				for (let r = 0; r < 2; r++) for (let P of sets) run(loud, 1 << 12, P, sets[1])
				for (let [ins, P, Q] of [...sets.map(P => [loud, P, P]), [loud, sets[1], sets[2]], ...bare ? sets.map(P => [bare, P, P]) : []]) {
					run(ins, B, P, Q)
					globalThis.gc()
					let gcs = 0, obs = new PerformanceObserver(l => { gcs += l.getEntries().length })
					obs.observe({ entryTypes: ['gc'] })
					run(ins, 1 << 17, P, Q)
					await new Promise(r => setTimeout(r, 10))
					obs.disconnect()
					worst = Math.max(worst, gcs)
				}
			}
			out[name] = worst
		}
		process.stdout.write(JSON.stringify(out))`
	let res = JSON.parse(execFileSync(process.execPath, ['--max-semi-space-size=1', '--expose-gc', '--no-concurrent-recompilation', '--input-type=module', '-e', code], { cwd: new URL('.', import.meta.url).pathname, encoding: 'utf8', timeout: 600e3 }))
	for (let [name, gcs] of Object.entries(res)) is(gcs, 0, `${name}: ${gcs} collections at the worst setting`)
})

// The family's manifests: audio.js names every member that has a manifest (a package of packages/ the umbrella depends
// on, with an audio.js), and no other; each name a member's manifest exports is the entry's, the same binding
test('audio.js lists every member that has a manifest', async () => {
	const { readdirSync, existsSync, readFileSync } = await import('node:fs')
	const at = p => new URL(p, import.meta.url), { dependencies } = JSON.parse(readFileSync(at('package.json'), 'utf8'))
	const members = readdirSync(at('packages')).filter(d => existsSync(at(`packages/${d}/audio.js`)))
		.map(d => JSON.parse(readFileSync(at(`packages/${d}/package.json`), 'utf8')).name).filter(n => n in dependencies).sort()
	const listed = [...readFileSync(at('audio.js'), 'utf8').matchAll(/^export \* from '(@audio\/[^']+)\/audio'$/gm)].map(m => m[1]).sort()
	is(listed, members, 'one line per member, no other')
	const family = await import(at('audio.js')), missing = []
	for (const m of members) for (const [k, v] of Object.entries(await import(`${m}/audio`))) if (k !== 'default' && family[k] !== v) missing.push(`${m}: ${k}`)
	is(missing, [], 'every name a member\'s manifest exports, the same binding')
})
