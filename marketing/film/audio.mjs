// Builds the film's sound: an ambient music bed, synthesised sound effects, the
// app's own toast chime, the opening takbirs of the adhan, and the voiceover
// (vo/cues.json cuts phrases out of one recording and places them). Writes work/mix.wav.
//
// Every effect is synthesised here, so no third-party sound library or licence is
// involved. The adhan and chime are the files the app already ships.
//
//   node audio.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(here, '../..');
const work = path.join(here, 'work');
fs.mkdirSync(work, { recursive: true });

// Keep these in step with window.TL in stage.html.
const TL = { notif: 9.0, ffStart: 12.8, toast: 14.4, lock: 19.0, overlay: 19.8, plug: 23.0, adhan: 26.0, lapse: 45.0, lapseEnd: 47.5, click: 49.6, release: 50.2, end: 52.6, dur: 59 };

const SR = 48000;
const N = Math.round(TL.dur * SR);
const music = [new Float32Array(N), new Float32Array(N)];
const fx = [new Float32Array(N), new Float32Array(N)];
const voice = [new Float32Array(N), new Float32Array(N)];
const adhan = [new Float32Array(N), new Float32Array(N)];

// ── helpers ───────────────────────────────────────────────────────────────
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const noise = () => rnd() * 2 - 1;
function put(bus, at, samples, gain = 1, pan = 0) {
  const s0 = Math.round(at * SR);
  const gl = gain * Math.cos((pan + 1) * Math.PI / 4), gr = gain * Math.sin((pan + 1) * Math.PI / 4);
  const [L, R] = Array.isArray(samples) ? samples : [samples, samples];
  for (let i = 0; i < L.length; i++) {
    const k = s0 + i;
    if (k < 0 || k >= N) continue;
    bus[0][k] += L[i] * gl * Math.SQRT2;
    bus[1][k] += R[i] * gr * Math.SQRT2;
  }
}
function tone(dur, fn) {
  const n = Math.round(dur * SR), out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = fn(i / SR, i / n);
  return out;
}
function lowpass(buf, cutoff) {
  const a = 1 - Math.exp(-2 * Math.PI * cutoff / SR);
  let y = 0;
  for (let i = 0; i < buf.length; i++) { y += a * (buf[i] - y); buf[i] = y; }
  return buf;
}
function readWav(file) {
  const b = fs.readFileSync(file);
  let p = 12, fmt, data;
  while (p < b.length) {
    const id = b.toString('ascii', p, p + 4), size = b.readUInt32LE(p + 4);
    if (id === 'fmt ') fmt = { ch: b.readUInt16LE(p + 10), sr: b.readUInt32LE(p + 12), bits: b.readUInt16LE(p + 22) };
    if (id === 'data') data = b.subarray(p + 8, p + 8 + size);
    p += 8 + size + (size % 2);
  }
  const frames = data.length / (fmt.ch * 2), L = new Float32Array(frames), R = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    L[i] = data.readInt16LE(i * fmt.ch * 2) / 32768;
    R[i] = fmt.ch > 1 ? data.readInt16LE(i * fmt.ch * 2 + 2) / 32768 : L[i];
  }
  return [L, R];
}
function decode(src, name) {
  const out = path.join(work, name);
  // public/assets/chime.mp3 is really a WAV; afconvert trusts the extension, so hand it a .wav
  if (fs.readFileSync(src).subarray(0, 4).toString('ascii') === 'RIFF' && !src.endsWith('.wav')) {
    const tmp = path.join(work, `src-${name}`);
    fs.copyFileSync(src, tmp);
    src = tmp;
  }
  execFileSync('afconvert', ['-f', 'WAVE', '-d', `LEI16@${SR}`, '-c', '2', src, out]);
  return readWav(out);
}
const slice = ([L, R], a, b) => [L.slice(Math.round(a * SR), Math.round(b * SR)), R.slice(Math.round(a * SR), Math.round(b * SR))];
function fadeEdges([L, R], inS, outS) {
  const n = L.length, fi = Math.round(inS * SR), fo = Math.round(outS * SR);
  for (let i = 0; i < n; i++) {
    const g = Math.min(1, i / Math.max(1, fi)) * Math.min(1, (n - i) / Math.max(1, fo));
    L[i] *= g; R[i] *= g;
  }
  return [L, R];
}

// ── music bed: slow ambient chords with a soft pulse ──────────────────────
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const CHORDS = [
  [45, 57, 60, 64, 67, 71], // Am9
  [41, 57, 60, 64, 65, 69], // Fmaj7
  [48, 55, 60, 64, 67, 74], // Cadd9
  [43, 55, 59, 62, 67, 69], // G6
];
function pad(start, end) {
  const bar = 3.6;
  for (let t0 = start, c = 0; t0 < end; t0 += bar, c++) {
    const chord = CHORDS[c % CHORDS.length];
    const len = Math.min(bar + 1.6, end - t0 + 1.6);
    chord.forEach((m, j) => {
      const f = hz(m), det = 1 + (j % 2 ? 0.0021 : -0.0017);
      const buf = tone(len, (t) => {
        const env = Math.min(1, t / 1.2) * Math.min(1, (len - t) / 1.4);
        return env * (Math.sin(2 * Math.PI * f * t) + 0.5 * Math.sin(2 * Math.PI * f * det * t + j)) * (j === 0 ? 0.5 : 0.11);
      });
      put(music, t0, lowpass(buf, j === 0 ? 300 : 2400), 0.55, j % 2 ? -0.35 : 0.35);
    });
    // soft plucked arpeggio, quarter notes
    for (let k = 0; k < 6; k++) {
      const m = chord[1 + (k % (chord.length - 1))] + 12;
      const at = t0 + k * (bar / 6);
      if (at > end - 0.3) break;
      put(music, at, tone(1.4, (t) => Math.exp(-t * 4.2) * (Math.sin(2 * Math.PI * hz(m) * t) + 0.3 * Math.sin(4 * Math.PI * hz(m) * t))), 0.07, k % 2 ? 0.5 : -0.5);
    }
  }
}
pad(0, TL.adhan - 0.6);
pad(TL.lapse + 1.2, TL.dur);

// ── sound effects ─────────────────────────────────────────────────────────
const click = (gain) => tone(0.035, (t) => noise() * Math.exp(-t * 260) * gain);
// typing, about eight keys a second while the code is written
for (let t = 0.85; t < 12.3; t += 0.07 + rnd() * 0.12) put(fx, t, lowpass(click(1), 5200), 0.16 + rnd() * 0.08, -0.25);
// chat messages
const pop = tone(0.18, (t) => Math.exp(-t * 26) * (t < 0.06 ? Math.sin(2 * Math.PI * 988 * t) : Math.sin(2 * Math.PI * 1318 * t)));
[2.6, 5.2, 7.6].forEach((at) => put(fx, at, pop, 0.18, 0.35));
// Waqt's notification: a soft glass bell
const bell = tone(1.6, (t) => Math.exp(-t * 3.2) * (Math.sin(2 * Math.PI * 1046.5 * t) + 0.55 * Math.sin(2 * Math.PI * 1568 * t) + 0.25 * Math.sin(2 * Math.PI * 2093 * t)));
put(fx, TL.notif + 0.05, bell, 0.2, 0.4);
// time skip whoosh
const whoosh = (dur, up = true) => {
  const b = tone(dur, (t, p) => noise() * Math.sin(Math.PI * p) ** 2);
  let y = 0;
  for (let i = 0; i < b.length; i++) {
    const p = i / b.length, fc = up ? 300 + 5000 * p : 5300 - 5000 * p;
    y += (1 - Math.exp(-2 * Math.PI * fc / SR)) * (b[i] - y); b[i] = y;
  }
  return b;
};
put(fx, TL.ffStart, whoosh(1.6), 0.35);
// toast: the app's own chime, then a soft tick for each of its ten seconds
put(fx, TL.toast, decode(path.join(root, 'public/assets/chime.mp3'), 'chime.wav'), 0.55);
for (let k = 1; k < 10; k++) put(fx, TL.toast + (k * (TL.lock - TL.toast)) / 10, tone(0.05, (t) => Math.exp(-t * 120) * Math.sin(2 * Math.PI * 2200 * t)), 0.07, 0.45);
// the desktop sweep, then the lock lands
put(fx, TL.lock, whoosh(0.9, false), 0.4, -0.2);
put(fx, TL.lock + 0.25, whoosh(0.8, false), 0.3, 0.3);
const impact = tone(2.8, (t) => {
  const f = 38 + 50 * Math.exp(-t * 6);
  return Math.exp(-t * 1.7) * Math.sin(2 * Math.PI * f * t) + noise() * Math.exp(-t * 30) * 0.25;
});
put(fx, TL.overlay, impact, 0.75);
put(fx, TL.overlay, lowpass(tone(3, (t) => Math.exp(-t * 1.2) * Math.sin(2 * Math.PI * 130.8 * t) * 0.6), 900), 0.25);
// a display connects
[[0, 659.3], [0.11, 987.8]].forEach(([d, f]) => put(fx, TL.plug + 0.2 + d, tone(0.35, (t) => Math.exp(-t * 12) * Math.sin(2 * Math.PI * f * t)), 0.18, -0.5));
// time-lapse riser
const riser = tone(TL.lapseEnd - TL.lapse + 0.3, (t, p) => (noise() * 0.5 + Math.sin(2 * Math.PI * (200 + 900 * p * p) * t) * 0.4) * p * p * Math.min(1, (1 - p) * 8));
put(fx, TL.lapse, lowpass(riser, 3800), 0.3);
// the click and a quiet confirmation
put(fx, TL.click, lowpass(click(1.5), 3000), 0.5, -0.1);
[[0, 72], [0.09, 76], [0.18, 79]].forEach(([d, m]) => put(fx, TL.click + 0.12 + d, tone(1.2, (t) => Math.exp(-t * 4) * Math.sin(2 * Math.PI * hz(m + 12) * t)), 0.11, 0.2));
// windows come back
put(fx, TL.release + 0.35, whoosh(0.9, true), 0.32, 0.2);
// end card swell
put(fx, TL.end, lowpass(tone(3.2, (t, p) => Math.sin(Math.PI * p) * (Math.sin(2 * Math.PI * 65.4 * t) + 0.4 * Math.sin(2 * Math.PI * 130.8 * t))), 600), 0.35);

// ── the adhan: its first two takbirs, with the silence between them trimmed ─
const takbeer = decode(path.join(root, 'public/assets/takbeer.mp3'), 'takbeer.wav');
const A = fadeEdges(slice(takbeer, 0.2, 4.5), 0.05, 0.4);
const B = fadeEdges(slice(takbeer, 6.35, 20.3), 0.05, 0.75);
put(adhan, TL.adhan, A, 0.95);
put(adhan, TL.adhan + 4.3 + 0.6, B, 0.95);

// ── voiceover: phrases cut from one recording (vo/cues.json) ───────────────
const voSpans = [];
const cueFile = path.join(here, 'vo', 'cues.json');
if (fs.existsSync(cueFile)) {
  const { recording, cues } = JSON.parse(fs.readFileSync(cueFile, 'utf8'));
  const rec = decode(path.join(here, 'vo', recording), 'voice.wav');
  // high-pass at ~80 Hz to take out rumble, then level the whole read to about -19 dBFS RMS
  for (const ch of rec) {
    const a = Math.exp(-2 * Math.PI * 80 / SR);
    let x1 = 0, y1 = 0;
    for (let i = 0; i < ch.length; i++) { const y = a * (y1 + ch[i] - x1); x1 = ch[i]; y1 = y; ch[i] = y; }
  }
  let e = 0, cnt = 0;
  cues.forEach((c) => { for (let i = Math.round(c.from * SR); i < Math.round(c.to * SR); i++) { e += rec[0][i] ** 2; cnt++; } });
  const level = Math.pow(10, -19 / 20) / Math.sqrt(e / Math.max(1, cnt));
  cues.forEach((c, i) => {
    const prevEnd = i > 0 ? cues[i - 1].to : 0, nextStart = i < cues.length - 1 ? cues[i + 1].from : c.to + 1;
    const a = Math.max(prevEnd + 0.02, c.from - 0.08), b = Math.min(nextStart - 0.02, c.to + 0.16);
    const clip = fadeEdges(slice(rec, a, b), 0.03, 0.06);
    const at = c.at - (c.from - a);
    put(voice, at, clip, level);
    voSpans.push([at, at + (b - a)]);
    if (at + (b - a) > TL.adhan && at < TL.adhan) console.warn(`cue ${i + 1} runs into the adhan`);
  });
  console.log(`voiceover: ${cues.length} phrases from ${recording}, gain ${level.toFixed(2)}`);
} else {
  console.log('voiceover: none (no vo/cues.json)');
}

// ── mix: duck the music under the voice, keep the adhan alone ─────────────
const duck = new Float32Array(N).fill(1);
voSpans.forEach(([a, b]) => {
  for (let k = Math.round((a - 0.25) * SR); k < Math.round((b + 0.35) * SR); k++) if (k >= 0 && k < N) duck[k] = 0.4;
});
let d = 1;
const out = Buffer.alloc(44 + N * 4);
let peak = 0;
const mixed = [new Float32Array(N), new Float32Array(N)];
for (let i = 0; i < N; i++) {
  d += (duck[i] - d) * 0.0008;
  for (let c = 0; c < 2; c++) {
    const v = music[c][i] * 0.55 * d + fx[c][i] + adhan[c][i] + voice[c][i];
    mixed[c][i] = v;
    peak = Math.max(peak, Math.abs(v));
  }
}
const g = peak > 0 ? Math.min(1, 0.89 / peak) : 1;
out.write('RIFF', 0); out.writeUInt32LE(36 + N * 4, 4); out.write('WAVEfmt ', 8);
out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(2, 22); out.writeUInt32LE(SR, 24);
out.writeUInt32LE(SR * 4, 28); out.writeUInt16LE(4, 32); out.writeUInt16LE(16, 34); out.write('data', 36); out.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) for (let c = 0; c < 2; c++) out.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(mixed[c][i] * g * 32767))), 44 + i * 4 + c * 2);
fs.writeFileSync(path.join(work, 'mix.wav'), out);
console.log(`wrote work/mix.wav (${TL.dur}s, peak gain ${g.toFixed(2)})`);
