// Measure @audio/dynamics-deesser on speech, singing and music. Run: `node scripts/deesser.js [path to a deesser.js]
// [options JSON]` (several minutes); LUFS=-16 normalizes each file first, as the editor's recipes do; SET=train measures
// the material the defaults were chosen on instead of the held-out VoiceBank test set. Prints the README's "Measured"
// tables: per 10 ms frame, how far the output's 4–10 kHz band (where an 's' sits) and 0.3–4 kHz band (the voice body)
// moved from the input's, by frame class:
//   s      active, ≥ 50 % of its energy above 3.5 kHz: the cut the de-esser exists for
//   voice  the other active frames: vowels and voiced consonants, whose change is damage
//   pause  inactive: room tone, whose change is the noise floor breathing
// Active: within 35 dB of the file's 99th-percentile frame, gaps under 60 ms bridged (a generous, level-only rule).
// Material, from ~/.cache/audiojs/data when present: VoiceBank clean speech (Valentini-Botinhao et al. 2016; the
// 824-utterance test set, or 504 training utterances of 28 other speakers), spoken Wikipedia articles (Wikimedia
// Commons, 10 × the first 60 s; SET=train: 10 others), VocalSet sung excerpts (Wilkins et al. 2018, 8 straight-tone
// takes), music as @audio/denoise's scripts/repair.js fetches it ("Vibe Ace", Brahms' Hungarian Dance No. 5, the
// first 60 s of the Nutcracker, a trumpet loop), and "Vibe Ace" under a synthetic ride cymbal: Gaussian noise through a
// 4th-order Butterworth high-pass at 4 kHz, decaying e^−4 over 0.5 s, a hit every 0.5 s, at −18, −12 and −6 dB re the
// mix, the sum at −16 LUFS; its cut is read on the frames where the ride holds over half the 4–10 kHz power.

import { readFileSync, readdirSync, existsSync } from 'fs'
import { homedir } from 'os'
import { highpass, process as biquad, state } from '@audio/biquad'

const deesser = (await import(process.argv[2] ? new URL(process.argv[2], `file://${process.cwd()}/`) : '@audio/dynamics-deesser')).default
const opts = JSON.parse(process.argv[3] || '{}'), LUFS = process.env.LUFS, train = process.env.SET === 'train'
const D = `${homedir()}/.cache/audiojs/data`
const ls = (d, re) => existsSync(d) ? readdirSync(d).filter(f => re.test(f)).sort().map(f => `${d}/${f}`) : []
const f32 = p => new Float32Array(readFileSync(p).buffer.slice(0))
function wav(p) {
  let b = readFileSync(p), v = new DataView(b.buffer, b.byteOffset, b.byteLength), o = 12, ch = 1
  while (o < b.length - 8) {
    let id = b.toString('ascii', o, o + 4), n = v.getUint32(o + 4, true)
    if (id === 'fmt ') ch = v.getUint16(o + 10, true)
    if (id === 'data') return Float32Array.from({ length: n / 2 / ch | 0 }, (_, i) => v.getInt16(o + 8 + i * 2 * ch, true) / 32768)
    o += 8 + n + (n & 1)
  }
}

// ITU-R BS.1770-4 integrated loudness: K-weighting re-derived for the rate (as pyloudnorm), 400 ms blocks, 75 %
// overlap, −70 LUFS absolute and −10 LU relative gates
function lufs(x, fs) {
  let K = f => Math.tan(Math.PI * f / fs), bq = ([b0, b1, b2], [a1, a2]) => { let x1 = 0, x2 = 0, y1 = 0, y2 = 0; return v => { let y = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = v; y2 = y1; y1 = y; return y } }
  let k = K(1681.9744509555319), Q = 0.7071752369554193, Vh = 10 ** (3.99984385397 / 20), Vb = Vh ** 0.4996667741545416, a = 1 + k / Q + k * k
  let shelf = bq([(Vh + Vb * k / Q + k * k) / a, 2 * (k * k - Vh) / a, (Vh - Vb * k / Q + k * k) / a], [2 * (k * k - 1) / a, (1 - k / Q + k * k) / a])
  let h = K(38.13547087613982), q = 0.5003270373253953, c = 1 + h / q + h * h, hp = bq([1, -2, 1], [2 * (h * h - 1) / c, (1 - h / q + h * h) / c])
  let B = Math.round(0.4 * fs), H = Math.round(0.1 * fs), cum = new Float64Array(x.length + 1), z = []
  for (let i = 0; i < x.length; i++) { let y = hp(shelf(x[i])); cum[i + 1] = cum[i] + y * y }
  for (let i = 0; i + B <= x.length; i += H) z.push((cum[i + B] - cum[i]) / B)
  let L = e => -0.691 + 10 * Math.log10(e), mean = a => a.reduce((s, e) => s + e, 0) / a.length
  let g = z.filter(e => L(e) > -70), rel = L(mean(g)) - 10
  return L(mean(g.filter(e => L(e) > rel)))
}

// per 10 ms frame (Hann, 512-point FFT): level, share above 3.5 kHz, 4–10 kHz and 0.3–4 kHz power
const N = 512, cs = Float64Array.from({ length: N / 2 }, (_, k) => Math.cos(2 * Math.PI * k / N)), sn = cs.map((_, k) => -Math.sin(2 * Math.PI * k / N))
function frames(x, fs) {
  let n = Math.round(fs / 100), m = Math.floor(x.length / n), w = Float64Array.from({ length: n }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1)))
  let F = { m, lv: [], hs: [], hi: [], md: [] }, re = new Float64Array(N), im = new Float64Array(N)
  for (let f = 0; f < m; f++) {
    re.fill(0); im.fill(0)
    let e = 0
    for (let i = 0; i < n; i++) { let v = x[f * n + i]; e += v * v; re[i] = v * w[i] }
    for (let i = 1, j = 0; i < N; i++) { let b = N >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t } }
    for (let len = 2; len <= N; len <<= 1) for (let i = 0; i < N; i += len) for (let k = 0; k < len / 2; k++) {
      let c = cs[k * N / len], s = sn[k * N / len], p = i + k, q = p + len / 2, tr = re[q] * c - im[q] * s, ti = re[q] * s + im[q] * c
      re[q] = re[p] - tr; im[q] = im[p] - ti; re[p] += tr; im[p] += ti
    }
    let all = 0, top = 0, hi = 0, md = 0
    for (let k = 0; k <= N / 2; k++) { let P = re[k] ** 2 + im[k] ** 2, hz = k * fs / N; all += P; if (hz >= 3500) top += P; if (hz >= 4000 && hz < 10000) hi += P; if (hz >= 300 && hz < 4000) md += P }
    F.lv.push(10 * Math.log10(e + 1e-20)); F.hs.push(top / (all + 1e-30)); F.hi.push(hi); F.md.push(md)
  }
  return F
}
const pct = (a, p) => { let s = Float64Array.from(a).sort(); return s.length ? s[Math.round(p / 100 * (s.length - 1))] : NaN }
function classes(F) {
  let ref = pct(F.lv, 99), act = F.lv.map(v => v > ref - 35), on = act.flatMap((a, i) => a ? [i] : [])
  for (let j = 1; j < on.length; j++) if (on[j] - on[j - 1] <= 6) for (let i = on[j - 1]; i < on[j]; i++) act[i] = true
  return act.map((a, i) => !a ? 'pause' : F.hs[i] >= 0.5 ? 's' : 'voice')
}
const dB = (y, x) => 10 * Math.log10((y + 1e-20) / (x + 1e-20))
const norm = (x, fs) => { if (!LUFS) return x; let g = 10 ** ((+LUFS - lufs(x, fs)) / 20); return x.map(v => v * g) }
const run = (x, fs) => deesser(Float32Array.from(x), { ...opts, sampleRate: fs })

const vb = ls(`${D}/${train ? 'vbdemand-train/clean' : 'vbdemand/clean_testset_wav'}`, /\.wav$/)
const vs = existsSync(`${D}/vocalset/FULL`) ? readdirSync(`${D}/vocalset/FULL`).sort().flatMap(s => ls(`${D}/vocalset/FULL/${s}/excerpts/straight`, /\.wav$/)) : []
const voices = [
  [`VoiceBank ${train ? 'train' : 'test'} (${vb.length})`, 48000, vb.map(p => () => wav(p))],
  ['narrations (10 × 60 s)', 48000, ls(`${D}/${train ? 'spoken-train' : 'spoken'}`, /\.f32$/).map(p => () => f32(p))],
  ['sung (VocalSet, 8)', 44100, vs.filter((_, i) => i % 6 === 0).slice(0, 8).map(p => () => wav(p))],
]
const f = v => (Math.abs(v) < 0.05 ? 0 : v).toFixed(1), share = (a, t) => `${(100 * a.filter(v => v < t).length / (a.length || 1)).toFixed(1)}%`

console.log(`\ndeesser(data, ${JSON.stringify(opts)})${LUFS ? ` at ${LUFS} LUFS` : ''}\n\n| | 's' frames, 4–10 kHz cut: median · 90th pct · most | voice frames moved > 1 dB | pauses moved > 1 dB |\n|---|---:|---:|---:|`)
for (let [name, fs, files] of voices) {
  let s = [], v = [], p = []
  if (!files.length) continue
  for (let load of files) {
    let x = norm(load(), fs)
    let X = frames(x, fs), Y = frames(run(x, fs), fs), c = classes(X)
    for (let k = 0; k < X.m; k++) {
      let h = dB(Y.hi[k], X.hi[k]), b = dB(Y.md[k], X.md[k]), moved = Math.max(Math.abs(h), Math.abs(b))
      c[k] === 's' ? s.push(h) : (c[k] === 'voice' ? v : p).push(-moved)
    }
  }
  console.log(`| ${name} | ${f(-pct(s, 50))} · ${f(-pct(s, 10))} · ${f(-s.reduce((a, b) => Math.min(a, b), 0))} dB | ${share(v, -1)} | ${share(p, -1)} |`)
}

const music = [['vibeace', 0], ['brahms', 0], ['nutcracker', 60], ['trumpet', 0]].filter(([k]) => existsSync(`${D}/repair/${k}.f32`))
if (music.length) {
  console.log('\nMusic, active frames moved > 1 dB (4–10 kHz or 0.3–4 kHz):', music.map(([k, sec]) => {
    let x = f32(`${D}/repair/${k}.f32`); if (sec) x = x.subarray(0, 44100 * sec)
    x = norm(x, 44100)
    let X = frames(x, 44100), Y = frames(run(x, 44100), 44100), c = classes(X), m = []
    for (let i = 0; i < X.m; i++) if (c[i] !== 'pause') m.push(-Math.max(Math.abs(dB(Y.hi[i], X.hi[i])), Math.abs(dB(Y.md[i], X.md[i]))))
    return `${k} ${share(m, -1)}`
  }).join(', '))
  let x = f32(`${D}/repair/vibeace.f32`), fs = 44100, r = 3, n = fs / 2, hit = new Float32Array(n)
  let rnd = () => (r = (Math.imul(r, 1664525) + 1013904223) >>> 0) / 4294967296
  for (let i = 0; i < n; i++) hit[i] = Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd())
  for (let q of [0.5411961, 1.306563]) biquad(hit, highpass(4000, q, fs), state())
  for (let i = 0; i < n; i++) hit[i] *= Math.exp(-4 * i / n)
  let ride = Float32Array.from(x, (_, i) => hit[i % n]), ex = x.reduce((s, v) => s + v * v, 0), er = ride.reduce((s, v) => s + v * v, 0)
  console.log('\n| ride cymbal re the mix | −18 dB | −12 dB | −6 dB |\n|---|---:|---:|---:|')
  let cells = [-18, -12, -6].map(rel => {
    let k = Math.sqrt(ex / er) * 10 ** (rel / 20), mix = x.map((v, i) => v + k * ride[i]), g = 10 ** ((-16 - lufs(mix, fs)) / 20)
    mix = mix.map(v => v * g)
    let M = frames(mix, fs), Y = frames(run(mix, fs), fs), R = frames(ride.map(v => v * k * g), fs), h = []
    for (let i = 0; i < M.m; i++) if (R.hi[i] > 0.5 * M.hi[i]) h.push(dB(Y.hi[i], M.hi[i]))
    return `${f(-pct(h, 50))} · ${f(-pct(h, 10))} dB`
  })
  console.log(`| its 4–10 kHz cut: median · 90th pct | ${cells.join(' | ')} |`)
}
