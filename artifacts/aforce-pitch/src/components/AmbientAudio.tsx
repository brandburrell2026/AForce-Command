import { useEffect, useRef, useState } from "react";

interface Voice {
  osc: OscillatorNode;
  gain: GainNode;
}

interface AudioEngine {
  ctx: AudioContext;
  master: GainNode;
  filter: BiquadFilterNode;
  lfo: OscillatorNode;
  lfoGain: GainNode;
  voices: Voice[];
}

function buildEngine(): AudioEngine {
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const ctx = new AC();

  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 700;
  filter.Q.value = 0.6;
  filter.connect(master);

  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.05;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 350;
  lfo.connect(lfoGain);
  lfoGain.connect(filter.frequency);
  lfo.start();

  const recipe: Array<{ freq: number; type: OscillatorType; gain: number; detune: number }> = [
    { freq: 55, type: "sine", gain: 0.32, detune: -6 },
    { freq: 110, type: "sine", gain: 0.18, detune: 4 },
    { freq: 164.8, type: "triangle", gain: 0.09, detune: -3 },
    { freq: 220, type: "triangle", gain: 0.06, detune: 7 },
    { freq: 329.6, type: "sine", gain: 0.04, detune: -2 },
  ];

  const voices: Voice[] = recipe.map(({ freq, type, gain, detune }) => {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    const g = ctx.createGain();
    g.gain.value = gain;
    osc.connect(g);
    g.connect(filter);
    osc.start();
    return { osc, gain: g };
  });

  return { ctx, master, filter, lfo, lfoGain, voices };
}

export default function AmbientAudio({
  enabled,
  volume = 0.18,
}: {
  enabled: boolean;
  volume?: number;
}) {
  const engineRef = useRef<AudioEngine | null>(null);
  const [, force] = useState(0);

  useEffect(() => {
    if (!enabled) {
      const eng = engineRef.current;
      if (eng) {
        const now = eng.ctx.currentTime;
        eng.master.gain.cancelScheduledValues(now);
        eng.master.gain.setValueAtTime(eng.master.gain.value, now);
        eng.master.gain.linearRampToValueAtTime(0, now + 0.6);
      }
      return;
    }

    if (!engineRef.current) {
      try {
        engineRef.current = buildEngine();
      } catch {
        return;
      }
    }
    const eng = engineRef.current;
    if (!eng) return;

    const resume = async () => {
      if (eng.ctx.state === "suspended") await eng.ctx.resume();
      const now = eng.ctx.currentTime;
      eng.master.gain.cancelScheduledValues(now);
      eng.master.gain.setValueAtTime(eng.master.gain.value, now);
      eng.master.gain.linearRampToValueAtTime(volume, now + 2.5);
      force((n) => n + 1);
    };
    void resume();
  }, [enabled, volume]);

  useEffect(() => {
    return () => {
      const eng = engineRef.current;
      if (!eng) return;
      try {
        eng.voices.forEach((v) => {
          v.osc.stop();
          v.osc.disconnect();
          v.gain.disconnect();
        });
        eng.lfo.stop();
        eng.lfo.disconnect();
        eng.lfoGain.disconnect();
        eng.filter.disconnect();
        eng.master.disconnect();
        void eng.ctx.close();
      } catch {
        // already closed
      }
      engineRef.current = null;
    };
  }, []);

  return null;
}
