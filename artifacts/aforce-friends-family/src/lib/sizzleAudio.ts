/**
 * Programmatic audio engine for the opening sizzle reel.
 *
 * The entire 45-second timeline is deterministic, so once the user gesture
 * unlocks the AudioContext we schedule every event up front against
 * `ctx.currentTime`. This is robust (no drifting setInterval schedulers) and
 * matches the visual clock closely enough for a cinematic intro.
 *
 * Act 1 (0–18s)  — accelerating notification blips, accelerating heartbeat,
 *                  rising band-passed static; everything cuts at 18s.
 * Act 2 (19–28s) — a low sine tone fades up out of silence.
 * Act 3 (28–42s) — a steady low rhythmic pulse; master fades out by 45s.
 */
/** Deterministic PRNG (mulberry32) so every playthrough sounds identical. */
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class SizzleAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private rng = makeRng(0xa4f0);

  async start(): Promise<void> {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;

    try {
      this.ctx = new Ctor();
      await this.ctx.resume().catch(() => {});
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.85;
      this.master.connect(this.ctx.destination);

      const t0 = this.ctx.currentTime + 0.06;
      this.scheduleAll(t0);
    } catch {
      this.ctx = null;
      this.master = null;
    }
  }

  stop(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const master = this.master;
    this.ctx = null;
    this.master = null;
    try {
      if (master) {
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
        master.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
      }
    } catch {
      /* ignore */
    }
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 200);
  }

  private blip(at: number, freq: number, dur: number, gain: number): void {
    if (!this.ctx || !this.master) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "square";
    o.frequency.setValueAtTime(freq, at);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(this.master);
    o.start(at);
    o.stop(at + dur + 0.02);
  }

  private thump(at: number, freq: number, gain: number): void {
    if (!this.ctx || !this.master) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(freq * 1.7, at);
    o.frequency.exponentialRampToValueAtTime(freq, at + 0.12);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.34);
    o.connect(g).connect(this.master);
    o.start(at);
    o.stop(at + 0.42);
  }

  private sine(
    start: number,
    end: number,
    freq: number,
    gain: number,
  ): void {
    if (!this.ctx || !this.master) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + 1.2);
    g.gain.setValueAtTime(gain, Math.max(start + 1.2, end - 1.0));
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    o.connect(g).connect(this.master);
    o.start(start);
    o.stop(end + 0.1);
  }

  private noiseSwell(start: number, end: number): void {
    if (!this.ctx || !this.master) return;
    const frames = Math.floor(this.ctx.sampleRate * 2);
    const buf = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = this.rng() * 2 - 1;

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1100;
    bp.Q.value = 0.6;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(0.1, end - 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, end);

    src.connect(bp).connect(g).connect(this.master);
    src.start(start);
    src.stop(end + 0.1);
  }

  private scheduleAll(t0: number): void {
    if (!this.ctx || !this.master) return;

    // ACT 1 — accelerating notification blips
    for (let t = 0; t < 18; ) {
      const prog = t / 18;
      this.blip(t0 + t, 540 + this.rng() * 1300, 0.055, 0.05 + prog * 0.13);
      t += Math.max(0.1, 0.85 - prog * 0.72);
    }

    // ACT 1 — accelerating heartbeat (lub-dub)
    for (let t = 1.0; t < 18; ) {
      const prog = t / 18;
      const g = 0.32 + prog * 0.42;
      this.thump(t0 + t, 52, g);
      this.thump(t0 + t + 0.18, 46, g * 0.8);
      t += Math.max(0.42, 1.0 - prog * 0.62);
    }

    // ACT 1 — rising static, hard-cut at 18
    this.noiseSwell(t0, t0 + 18);

    // ACT 2 — low sine out of silence (after a 1s held black at 18–19)
    this.sine(t0 + 19, t0 + 28, 82, 0.2);
    this.sine(t0 + 20, t0 + 28, 164, 0.05);

    // ACT 3 — steady rhythmic pulse
    for (let t = 28; t < 42; t += 1.0) {
      this.thump(t0 + t, 60, 0.38);
    }

    // master fade out into the deck
    this.master.gain.setValueAtTime(0.85, t0 + 44);
    this.master.gain.linearRampToValueAtTime(0.0001, t0 + 45);
  }
}
