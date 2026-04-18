import test, { almost, ok, is } from 'tst'
import { compressor, limiter, gate, expander, deesser, ducker, softclip, compand, envelope } from './index.js'

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

test('compressor — streaming matches batch length', () => {
  let data = sine(1000, 4096, 0.8)
  let write = compressor({ threshold: -20, ratio: 4, attack: 1, release: 10 })
  let a = write(data.subarray(0, 2048))
  let b = write(data.subarray(2048))
  let tail = write()
  is(a.length + b.length + tail.length, data.length)
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

test('limiter — streaming preserves length', () => {
  let data = sine(500, 4096, 0.9)
  let write = limiter({ ceiling: -6 })
  let a = write(data.subarray(0, 2048))
  let b = write(data.subarray(2048))
  let tail = write()
  is(a.length + b.length + tail.length, data.length)
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


// --- expander ---

test('expander — gentle reduction below threshold', () => {
  let quiet = sine(1000, fs >> 2, 0.03)  // ≈ -30 dB
  let out = expander(quiet, { threshold: -20, ratio: 2, range: -20, attack: 1, release: 5 })
  ok(rms(out) < rms(quiet), 'reduced')
  ok(rms(out) > rms(quiet) * 0.05, 'not full gate')
})


// --- deesser ---

test('deesser — attenuates HF band, passes LF', () => {
  let lowMix = sine(200, fs >> 1, 0.5)
  let outLow = deesser(lowMix, { freq: 6500, threshold: -30, ratio: 8 })
  almost(rms(outLow), rms(lowMix), rms(lowMix) * 0.1, 'LF passes')

  let sib = sine(6500, fs >> 1, 0.5)
  let outSib = deesser(sib, { freq: 6500, threshold: -30, ratio: 8, attack: 1, release: 5 })
  ok(rms(outSib) < rms(sib) * 0.8, 'sibilance reduced')
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
