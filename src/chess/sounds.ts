// Sound effects using Web Audio API — no external audio files needed.
// Each sound is a short synthesized tone that fits the context.

type SoundName = "move" | "capture" | "check" | "checkmate" | "victory" | "click" | "promote";

let audioCtx: AudioContext | null = null;
let enabled = true;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtx = new AC();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

function tone(
  freq: number,
  duration: number,
  type: OscillatorType = "sine",
  volume = 0.15,
  delay = 0,
) {
  const ctx = getCtx();
  if (!ctx || !enabled) return;
  if (ctx.state === "suspended") void ctx.resume();

  const start = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function noise(duration: number, volume = 0.1, delay = 0) {
  const ctx = getCtx();
  if (!ctx || !enabled) return;
  if (ctx.state === "suspended") void ctx.resume();
  const start = ctx.currentTime + delay;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 1200;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  src.start(start);
}

export const sounds = {
  play(name: SoundName) {
    if (!enabled) return;
    switch (name) {
      case "move":
        tone(480, 0.08, "triangle", 0.12);
        tone(620, 0.06, "triangle", 0.08, 0.02);
        break;
      case "capture":
        noise(0.12, 0.18);
        tone(260, 0.15, "sawtooth", 0.15);
        tone(180, 0.2, "triangle", 0.12, 0.03);
        break;
      case "check":
        tone(880, 0.12, "square", 0.12);
        tone(660, 0.15, "square", 0.1, 0.1);
        tone(880, 0.2, "square", 0.08, 0.2);
        break;
      case "checkmate":
      case "victory": {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((n, i) => tone(n, 0.3, "triangle", 0.18, i * 0.12));
        break;
      }
      case "click":
        tone(1200, 0.04, "sine", 0.08);
        break;
      case "promote":
        tone(523, 0.1, "triangle", 0.15);
        tone(784, 0.12, "triangle", 0.15, 0.08);
        tone(1046, 0.18, "triangle", 0.18, 0.18);
        break;
    }
  },
  setEnabled(v: boolean) {
    enabled = v;
  },
  isEnabled() {
    return enabled;
  },
};
