import test, { almost, ok, is } from 'tst'
import { compressor, limiter, gate, expander, deesser, ducker, softclip, compand, envelope, transientShaper, multiband, opto, fet, vca, varimu, leveler } from './index.js'

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


test('expander — hard knee (knee: 0) yields no NaN', () => {
  let quiet = sine(1000, fs >> 2, 0.03)
  let out = expander(quiet, { threshold: -30, ratio: 2, knee: 0 })
  for (let i = 0; i < out.length; i++) if (Number.isNaN(out[i])) throw new Error(`NaN at ${i}`)
  ok(rms(out) < rms(quiet), 'expands')
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

function impulse (n = 64) { let d = new Float64Array(n); d[0] = 1; return d }

test('transientShaper — produces output without NaN', () => {
	let data = impulse(4096)
	// Add some signal
	for (let i = 0; i < 100; i++) data[i] = Math.sin(2 * Math.PI * 440 * i / 44100) * (1 - i / 100)
	transientShaper(data, { attackGain: 2, sustainGain: -0.5, fs: 44100 })
	ok(data.every(isFinite), 'no NaN/Inf')
	ok(data.some(x => Math.abs(x) > 0.001), 'has output')
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
	leveler(d, { fs: sr, target: -20 })
	ok(d.every(v => Math.abs(v) <= 1), 'no clipping')
	let qDb = toDb(rmsOf(d, sr, 2 * sr))
	let lDb = toDb(rmsOf(d, quiet.length + sr, quiet.length + 2 * sr))
	almost(qDb, -20, 2.5, 'quiet section ' + qDb.toFixed(1))
	almost(lDb, -20, 2.5, 'loud section ' + lDb.toFixed(1))
})
