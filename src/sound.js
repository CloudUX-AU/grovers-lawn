// Original waltz loop and effects. Browsers start audio on the first gesture.

let audioCtx = null;
let musicBus = null;
let effectBus = null;
let barkBus = null;
let musicOn = false;
let nextStepAt = 0;
let stepIndex = 0;
let barkReadyAt = 0;

const QUARTER = 60 / 96;
const LEAD = [65, 69, 72, 69, 67, 65, 64, 65, 67, 69, 72, 69];
const BASS = [41, 0, 0, 48, 0, 0, 43, 0, 0, 48, 0, 0];

function midiHz(note) {
  return 440 * 2 ** ((note - 69) / 12);
}

function audio() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
    const master = audioCtx.createGain();
    master.gain.value = 0.8;
    master.connect(audioCtx.destination);
    musicBus = audioCtx.createGain();
    musicBus.gain.value = 0.16;
    musicBus.connect(master);
    effectBus = audioCtx.createGain();
    effectBus.gain.value = 0.55;
    effectBus.connect(master);
    barkBus = audioCtx.createGain();
    barkBus.gain.value = 0.42;
    barkBus.connect(master);
    startBeds();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

let sprayGain = null;
let rumbleGain = null;
let rumbleOsc = null;

function startBeds() {
  const seconds = 2;
  const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate * seconds, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const spray = audioCtx.createBufferSource();
  spray.buffer = buffer;
  spray.loop = true;
  const sprayFilter = audioCtx.createBiquadFilter();
  sprayFilter.type = "highpass";
  sprayFilter.frequency.value = 2400;
  sprayGain = audioCtx.createGain();
  sprayGain.gain.value = 0;
  spray.connect(sprayFilter);
  sprayFilter.connect(sprayGain);
  sprayGain.connect(effectBus);
  spray.start();

  rumbleOsc = audioCtx.createOscillator();
  rumbleOsc.type = "sawtooth";
  rumbleOsc.frequency.value = 46;
  const rumbleFilter = audioCtx.createBiquadFilter();
  rumbleFilter.type = "lowpass";
  rumbleFilter.frequency.value = 160;
  rumbleGain = audioCtx.createGain();
  rumbleGain.gain.value = 0;
  rumbleOsc.connect(rumbleFilter);
  rumbleFilter.connect(rumbleGain);
  rumbleGain.connect(effectBus);
  rumbleOsc.start();
}

function soundScene(sprayOn, rumble) {
  if (!musicOn || !sprayGain || !rumbleGain) return;
  const when = audioCtx.currentTime;
  rumbleGain.gain.setTargetAtTime(rumble, when, 0.07);
  rumbleOsc.frequency.setTargetAtTime(rumble > 0.2 ? 58 : 44, when, 0.08);
  sprayGain.gain.cancelScheduledValues(when);
  if (sprayOn) sprayGain.gain.setTargetAtTime(0.07, when, 0.05);
  else sprayGain.gain.setValueAtTime(0, when);
}

function blip(freq, when, dur, type, bus, volume) {
  const ctx = audio();
  if (!ctx || !freq) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, when);
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(volume, when + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  osc.connect(gain);
  gain.connect(bus);
  osc.start(when);
  osc.stop(when + dur + 0.02);
}

function scheduleMusic() {
  const ctx = audio();
  if (!ctx || !musicOn) return;
  const horizon = ctx.currentTime + QUARTER;
  while (nextStepAt < horizon) {
    const lead = LEAD[stepIndex % LEAD.length];
    const bass = BASS[stepIndex % BASS.length];
    blip(midiHz(lead), nextStepAt, QUARTER * 0.85, "sine", musicBus, 0.28);
    blip(midiHz(lead - 12), nextStepAt, QUARTER * 0.7, "triangle", musicBus, 0.12);
    if (bass) blip(midiHz(bass), nextStepAt, QUARTER * 1.4, "sine", musicBus, 0.34);
    stepIndex += 1;
    nextStepAt += QUARTER;
  }
  window.setTimeout(scheduleMusic, 180);
}

function soundStart() {
  const ctx = audio();
  if (!ctx || musicOn) return;
  musicOn = true;
  nextStepAt = ctx.currentTime + 0.05;
  stepIndex = 0;
  scheduleMusic();
}

function soundPoo() {
  const ctx = audio();
  if (!ctx) return;
  const when = ctx.currentTime;
  const squelch = (start, seconds, open, close) => {
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      const env = Math.sin((i / length) * Math.PI);
      data[i] = (Math.random() * 2 - 1) * env;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(open, start);
    filter.frequency.exponentialRampToValueAtTime(close, start + seconds);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.95, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(effectBus);
    source.start(start);
  };
  squelch(when, 0.28, 1600, 180);
  squelch(when + 0.08, 0.22, 900, 120);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(240, when);
  osc.frequency.exponentialRampToValueAtTime(55, when + 0.26);
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(0.7, when + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.3);
  osc.connect(gain);
  gain.connect(effectBus);
  osc.start(when);
  osc.stop(when + 0.32);
  blip(140, when + 0.16, 0.12, "sine", effectBus, 0.35);
}

function soundGrrr() {
  const ctx = audio();
  if (!ctx) return;
  const when = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(78, when);
  osc.frequency.linearRampToValueAtTime(52, when + 0.42);
  const wobble = ctx.createOscillator();
  const wobbleGain = ctx.createGain();
  wobble.frequency.value = 18;
  wobbleGain.gain.value = 10;
  wobble.connect(wobbleGain);
  wobbleGain.connect(osc.frequency);
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(0.35, when + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.48);
  osc.connect(gain);
  gain.connect(effectBus);
  osc.start(when);
  wobble.start(when);
  osc.stop(when + 0.5);
  wobble.stop(when + 0.5);
}

function soundBark() {
  const ctx = audio();
  if (!ctx || ctx.currentTime < barkReadyAt) return;
  barkReadyAt = ctx.currentTime + 0.28;
  const when = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(680, when);
  osc.frequency.exponentialRampToValueAtTime(1280, when + 0.045);
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(0.55, when + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.06);
  osc.connect(gain);
  gain.connect(barkBus);
  osc.start(when);
  osc.stop(when + 0.07);
}
