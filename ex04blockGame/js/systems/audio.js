/** Web Audio BGM + SFX */

let audioCtx = null;
let masterGain = null;
let bgmNodes = null;
let muted = false;

export function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = muted ? 0 : 0.9;
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
}

function beep(freq, dur, type = "square", vol = 0.08, slide = 0) {
  if (!audioCtx || muted) return;
  const t0 = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
  }
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(t0);
  osc.stop(t0 + dur);
}

function noiseBurst(dur = 0.08, vol = 0.05) {
  if (!audioCtx || muted) return;
  const t0 = audioCtx.currentTime;
  const len = Math.floor(audioCtx.sampleRate * dur);
  const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = audioCtx.createBufferSource();
  const gain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1800;
  src.buffer = buf;
  gain.gain.value = vol;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  src.start(t0);
}

export const SFX = {
  bounce: () => beep(220, 0.06, "triangle", 0.05),
  brick: () => {
    beep(520, 0.08, "square", 0.06, -200);
    noiseBurst(0.05, 0.03);
  },
  power: () => beep(660, 0.14, "sawtooth", 0.055, 280),
  lose: () => beep(120, 0.35, "sawtooth", 0.07, -80),
  launch: () => beep(340, 0.1, "square", 0.045, 180),
  laser: () => {
    beep(880, 0.06, "sawtooth", 0.05, 400);
    beep(1200, 0.04, "square", 0.03);
  },
  bossHit: () => {
    beep(90, 0.12, "sawtooth", 0.08);
    noiseBurst(0.12, 0.06);
  },
  bossAppear: () => {
    beep(110, 0.25, "sawtooth", 0.08, 40);
    setTimeout(() => beep(165, 0.25, "sawtooth", 0.08), 120);
    setTimeout(() => beep(220, 0.35, "square", 0.09), 240);
  },
  clear: () => {
    beep(440, 0.1, "square", 0.06);
    setTimeout(() => beep(554, 0.1, "square", 0.06), 80);
    setTimeout(() => beep(659, 0.18, "square", 0.07), 160);
  },
};

export function startBgm() {
  ensureAudio();
  if (bgmNodes || muted) return;

  const bass = audioCtx.createOscillator();
  const lead = audioCtx.createOscillator();
  const bassGain = audioCtx.createGain();
  const leadGain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();

  bass.type = "sawtooth";
  lead.type = "square";
  filter.type = "lowpass";
  filter.frequency.value = 900;
  bassGain.gain.value = 0.035;
  leadGain.gain.value = 0.02;

  bass.connect(filter);
  filter.connect(bassGain);
  bassGain.connect(masterGain);
  lead.connect(leadGain);
  leadGain.connect(masterGain);

  const bassNotes = [55, 55, 65.41, 49, 55, 73.42, 65.41, 49];
  const leadNotes = [220, 0, 277, 330, 0, 277, 247, 220, 0, 330, 370, 0];
  let step = 0;

  const lfo = setInterval(() => {
    if (!audioCtx || muted || !bgmNodes) return;
    const t = audioCtx.currentTime;
    bass.frequency.setTargetAtTime(bassNotes[step % bassNotes.length], t, 0.01);
    const ln = leadNotes[step % leadNotes.length];
    if (ln > 0) {
      lead.frequency.setTargetAtTime(ln, t, 0.005);
      leadGain.gain.setTargetAtTime(0.018, t, 0.01);
    } else {
      leadGain.gain.setTargetAtTime(0.001, t, 0.02);
    }
    filter.frequency.setTargetAtTime(700 + (step % 4) * 180, t, 0.05);
    step++;
  }, 220);

  bass.start();
  lead.start();
  bgmNodes = { bass, lead, lfo };
}

export function stopBgm() {
  if (!bgmNodes) return;
  clearInterval(bgmNodes.lfo);
  try {
    bgmNodes.bass.stop();
    bgmNodes.lead.stop();
  } catch (_) {
    /* already stopped */
  }
  bgmNodes = null;
}

export function isMuted() {
  return muted;
}

export function setMuted(v) {
  muted = v;
  if (masterGain) masterGain.gain.value = muted ? 0 : 0.9;
  if (muted) stopBgm();
}

export function toggleMute() {
  setMuted(!muted);
  return muted;
}
