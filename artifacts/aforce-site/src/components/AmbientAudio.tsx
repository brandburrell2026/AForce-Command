import { useEffect, useRef, useState } from 'react';

type SectionId = 'hero' | 'product' | 'loop' | 'os' | 'ecosystem' | 'future';

const SECTION_INTENSITY: Record<SectionId, number> = {
  hero: 0.18,
  product: 0.10,
  loop: 0.14,
  os: 0.12,
  ecosystem: 0.16,
  future: 0.22,
};

export function AmbientAudio() {
  const [enabled, setEnabled] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionId>('hero');
  const activeSectionRef = useRef<SectionId>('hero');

  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const oscillatorsRef = useRef<OscillatorNode[]>([]);
  const teardownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep ref in sync so the init effect can read the latest section without re-running.
  useEffect(() => {
    activeSectionRef.current = activeSection;
  }, [activeSection]);

  // Section detection — independent of audio lifecycle.
  useEffect(() => {
    const sectionIds: Exclude<SectionId, 'hero' | 'future'>[] = [
      'product',
      'loop',
      'os',
      'ecosystem',
    ];
    const observers: IntersectionObserver[] = [];

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && entry.intersectionRatio > 0.4) {
              setActiveSection(id);
            }
          });
        },
        { threshold: [0.4, 0.7], rootMargin: '-15% 0px -15% 0px' }
      );
      obs.observe(el);
      observers.push(obs);
    });

    const onScroll = () => {
      if (window.scrollY < window.innerHeight * 0.7) {
        setActiveSection('hero');
      } else if (
        window.scrollY + window.innerHeight >=
        document.body.scrollHeight - window.innerHeight * 0.5
      ) {
        setActiveSection('future');
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    return () => {
      observers.forEach((o) => o.disconnect());
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  // Hard teardown — safe to call multiple times.
  const teardownAudio = () => {
    oscillatorsRef.current.forEach((osc) => {
      try { osc.stop(); } catch { /* already stopped */ }
      try { osc.disconnect(); } catch { /* noop */ }
    });
    oscillatorsRef.current = [];
    if (masterRef.current) {
      try { masterRef.current.disconnect(); } catch { /* noop */ }
      masterRef.current = null;
    }
    if (ctxRef.current) {
      ctxRef.current.close().catch(() => undefined);
      ctxRef.current = null;
    }
  };

  // Audio lifecycle — keyed only on `enabled`.
  useEffect(() => {
    // Cancel any pending teardown from a previous disable cycle.
    if (teardownTimeoutRef.current) {
      clearTimeout(teardownTimeoutRef.current);
      teardownTimeoutRef.current = null;
    }

    if (!enabled) {
      const ctx = ctxRef.current;
      const master = masterRef.current;
      if (ctx && master) {
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
        master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
        teardownTimeoutRef.current = setTimeout(() => {
          teardownTimeoutRef.current = null;
          teardownAudio();
        }, 700);
      }
      return;
    }

    // Enable path — guard against re-init if graph already exists.
    if (ctxRef.current) return;

    const AudioCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtor();
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 600;
    lowpass.Q.value = 0.7;
    lowpass.connect(master);

    // Layered pad — open fifth + octave, each with a slightly detuned partner.
    const freqs = [55, 82.5, 110]; // A1, E2, A2
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const oscGain = ctx.createGain();
      oscGain.gain.value = i === 0 ? 0.35 : 0.18;
      osc.connect(oscGain);
      oscGain.connect(lowpass);
      osc.start();
      oscillatorsRef.current.push(osc);

      const partner = ctx.createOscillator();
      partner.type = 'sine';
      partner.frequency.value = freq * 1.005;
      const partnerGain = ctx.createGain();
      partnerGain.gain.value = i === 0 ? 0.2 : 0.1;
      partner.connect(partnerGain);
      partnerGain.connect(lowpass);
      partner.start();
      oscillatorsRef.current.push(partner);
    });

    // Slow LFO on filter cutoff for breath.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain);
    lfoGain.connect(lowpass.frequency);
    lfo.start();
    oscillatorsRef.current.push(lfo);

    // Sub layer — single low pulse for tension.
    const subOsc = ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.value = 41.2; // E1
    const subGain = ctx.createGain();
    subGain.gain.value = 0.25;
    subOsc.connect(subGain);
    subGain.connect(master);
    subOsc.start();
    oscillatorsRef.current.push(subOsc);

    ctxRef.current = ctx;
    masterRef.current = master;

    // Fade in to current section intensity (read via ref to avoid re-running effect).
    const target = SECTION_INTENSITY[activeSectionRef.current];
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(target, ctx.currentTime + 1.8);
  }, [enabled]);

  // Unmount cleanup — always tear down, regardless of enabled state.
  useEffect(() => {
    return () => {
      if (teardownTimeoutRef.current) {
        clearTimeout(teardownTimeoutRef.current);
        teardownTimeoutRef.current = null;
      }
      teardownAudio();
    };
  }, []);

  // Respond to section changes.
  useEffect(() => {
    if (!enabled) return;
    const ctx = ctxRef.current;
    const master = masterRef.current;
    if (!ctx || !master) return;
    const target = SECTION_INTENSITY[activeSection];
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.linearRampToValueAtTime(target, ctx.currentTime + 2.4);
  }, [activeSection, enabled]);

  return (
    <button
      onClick={() => setEnabled((v) => !v)}
      aria-label={enabled ? 'Mute ambient audio' : 'Enable ambient audio'}
      aria-pressed={enabled}
      className="group fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-2.5 rounded-full bg-black/70 backdrop-blur-md border border-white/10 hover:border-primary/60 transition-all duration-500"
    >
      <div className="flex items-end gap-[2px] h-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-[2px] rounded-full transition-all duration-700 ${
              enabled ? 'bg-primary' : 'bg-white/40'
            }`}
            style={{
              height: enabled ? `${30 + ((i * 23) % 70)}%` : '30%',
              animation: enabled
                ? `audioBar 1.${i + 2}s ease-in-out infinite alternate`
                : 'none',
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </div>
      <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-white/70 group-hover:text-white">
        {enabled ? 'Sound On' : 'Sound Off'}
      </span>
      <style>{`
        @keyframes audioBar {
          0%   { transform: scaleY(0.5); }
          100% { transform: scaleY(1.4); }
        }
      `}</style>
    </button>
  );
}
