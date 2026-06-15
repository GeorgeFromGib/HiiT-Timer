// Generates the WAV cue files used by audio.ts.
// Run once: node scripts/generate-audio.js
// Same tone parameters as the original synthesised data-URI approach.

const fs   = require('fs');
const path = require('path');

const SR = 22050;

function buildWav(samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);                    buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8);                    buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);               // PCM subchunk size
  buf.writeUInt16LE(1,  20);               // PCM = 1
  buf.writeUInt16LE(1,  22);               // mono
  buf.writeUInt32LE(SR,     24);
  buf.writeUInt32LE(SR * 2, 28);           // byte rate
  buf.writeUInt16LE(2,  32);               // block align
  buf.writeUInt16LE(16, 34);               // bits per sample
  buf.write('data', 36);                   buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(samples[i] * 32767), 44 + i * 2);
  }
  return buf;
}

function tone(hz, sec, vol = 0.7) {
  const n    = Math.floor(SR * sec);
  const fade = Math.min(Math.floor(SR * 0.015), Math.floor(n / 4));
  const s    = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let amp = vol;
    if      (i < fade)     amp *= i / fade;
    else if (i > n - fade) amp *= (n - i) / fade;
    s[i] = amp * Math.sin((2 * Math.PI * hz * i) / SR);
  }
  return buildWav(s);
}

function silence(sec) {
  return buildWav(new Float32Array(Math.floor(SR * sec)));
}

function concat(...wavBufs) {
  const totalSamples = wavBufs.reduce((sum, b) => sum + (b.length - 44) / 2, 0);
  const out = Buffer.alloc(44 + totalSamples * 2);
  wavBufs[0].copy(out, 0, 0, 44);
  out.writeUInt32LE(36 + totalSamples * 2, 4);
  out.writeUInt32LE(totalSamples * 2, 40);
  let offset = 44;
  for (const b of wavBufs) {
    b.copy(out, offset, 44);
    offset += b.length - 44;
  }
  return out;
}

const outDir = path.join(__dirname, '../assets/audio');
fs.mkdirSync(outDir, { recursive: true });

const files = {
  'keepalive.wav': silence(2),       // looped to keep iOS audio session alive
  'high.wav':      tone(880,  0.25), // A5 — "go"
  'low.wav':       tone(523,  0.25), // C5 — "recover"
  'tick.wav':      tone(1047, 0.07), // C6 — 3-2-1 blip
  'finish.wav':    concat(           // rising arpeggio ta-da
    tone(1047, 0.13, 0.7),           // C6 blip
    tone(1319, 0.13, 0.7),           // E6 blip
    tone(1568, 0.13, 0.7),           // G6 blip
    tone(1568, 0.40, 0.9),           // G6 sustain
  ),
};

for (const [name, buf] of Object.entries(files)) {
  const p = path.join(outDir, name);
  fs.writeFileSync(p, buf);
  console.log('wrote', p, `(${buf.length} bytes)`);
}
