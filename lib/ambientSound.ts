// Procedurally generates soft ambient soundscapes using the Web Audio API.
// No external audio files are needed, which keeps this fully offline and
// avoids any licensing concerns around ambient sound tracks.

export type AmbientPreset = "rain" | "waves" | "cafe";

let audioCtx: AudioContext | null = null;
let noiseSource: AudioBufferSourceNode | null = null;
let filterNode: BiquadFilterNode | null = null;
let gainNode: GainNode | null = null;
let lfo: OscillatorNode | null = null;
let lfoGain: GainNode | null = null;

function createNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const bufferSize = 4 * ctx.sampleRate;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

const PRESETS: Record<AmbientPreset, { cutoff: number; q: number; volume: number; swell?: boolean }> = {
  rain: { cutoff: 900, q: 0.7, volume: 0.05 },
  cafe: { cutoff: 420, q: 0.5, volume: 0.045 },
  waves: { cutoff: 700, q: 0.6, volume: 0.055, swell: true },
};

export function startAmbientRain(preset: AmbientPreset = "rain") {
  stopAmbientRain();

  const cfg = PRESETS[preset];
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  audioCtx = new Ctx();

  noiseSource = audioCtx.createBufferSource();
  noiseSource.buffer = createNoiseBuffer(audioCtx);
  noiseSource.loop = true;

  filterNode = audioCtx.createBiquadFilter();
  filterNode.type = "lowpass";
  filterNode.frequency.value = cfg.cutoff;
  filterNode.Q.value = cfg.q;

  gainNode = audioCtx.createGain();
  gainNode.gain.value = cfg.volume;

  noiseSource.connect(filterNode);
  filterNode.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  if (cfg.swell) {
    // Slow amplitude modulation to mimic ocean wave swells rolling in and out.
    lfo = audioCtx.createOscillator();
    lfo.frequency.value = 0.12; // roughly one swell every ~8 seconds
    lfoGain = audioCtx.createGain();
    lfoGain.gain.value = cfg.volume * 0.5;
    lfo.connect(lfoGain);
    lfoGain.connect(gainNode.gain);
    lfo.start();
  }

  noiseSource.start(0);
}

export function stopAmbientRain() {
  try {
    noiseSource?.stop();
    noiseSource?.disconnect();
    filterNode?.disconnect();
    gainNode?.disconnect();
    lfo?.stop();
    lfo?.disconnect();
    lfoGain?.disconnect();
    audioCtx?.close();
  } catch {
    // already stopped, ignore
  }
  audioCtx = null;
  noiseSource = null;
  filterNode = null;
  gainNode = null;
  lfo = null;
  lfoGain = null;
}

export function setAmbientVolume(v: number) {
  if (gainNode) gainNode.gain.value = v;
}