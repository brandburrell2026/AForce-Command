export default function Mission() {
  const tenets = [
    {
      eyebrow: "The Brand Truth",
      title: "Performance is non-negotiable.",
      body: "Not your best ever. Not your best in perfect conditions. Your best, reliably, consistently, every single day. The one standard this category has not yet defined.",
      accent: "text-accent",
      ring: "ring-accent/35",
      bar: "bg-accent",
      bg: "from-accent/[0.10] to-accent/0",
    },
    {
      eyebrow: "The Human Insight",
      title: "There is a kind of person who does not get to be off.",
      body: "The gap between what they're capable of and what they deliver is not talent or ambition. It is consistency under pressure.",
      accent: "text-blue",
      ring: "ring-blue/35",
      bar: "bg-blue",
      bg: "from-blue/[0.10] to-blue/0",
    },
    {
      eyebrow: "The Category Claim",
      title: "Where others capture moments, AForce sets the baseline.",
      body: "Not a hydration brand. Not a sports drink. A daily performance system built on hydration intelligence — and a performance discipline.",
      accent: "text-primary",
      ring: "ring-primary/35",
      bar: "bg-primary",
      bg: "from-primary/[0.10] to-primary/0",
    },
  ];

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 60% 50% at 22% 30%, rgba(245,214,55,0.14) 0%, transparent 65%)" }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 60% 50% at 80% 75%, rgba(84,120,213,0.10) 0%, transparent 65%)" }}
      />

      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-accent font-semibold">03 — Mission</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">3 / 24</div>
      </div>

      <div className="absolute top-[12vh] left-[6vw] right-[6vw] flex justify-between items-end gap-[4vw]">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-[1.2vw] mb-[1.4vh]">
            <div className="h-[2px] w-[5vw] bg-accent" />
            <span className="font-body uppercase tracking-[0.32em] text-[1.3vw] text-accent font-semibold">Mission</span>
          </div>
          <h2 className="font-display text-[4.4vw] leading-[0.95] tracking-tighter">
            Performance is <span className="text-accent">non-negotiable.</span>
          </h2>
          <p className="mt-[1.6vh] font-display text-[1.55vw] leading-[1.2] text-text/80 max-w-[44vw]">
            For professionals who <span className="text-accent">do not get to be off.</span>
          </p>
        </div>
        <div className="max-w-[28vw] pb-[0.4vh] text-right">
          <div className="flex items-start justify-end gap-[0.7vw]">
            <p className="font-display italic text-[1.1vw] leading-[1.4] tracking-tight text-text">
              <span className="text-accent">"</span>The energy category is <span className="text-accent">loud by design.</span><br />
              AForce removes noise. It removes friction.<br />
              It creates the focus for performance.<span className="text-accent">"</span>
            </p>
          </div>
          <div className="mt-[1.2vh] font-body uppercase tracking-[0.28em] text-[0.7vw] text-text/55 font-semibold">
            Brandon &amp; Julius Burrell
          </div>
        </div>
      </div>

      <div className="absolute top-[42vh] bottom-[20vh] left-[6vw] right-[6vw]">
        <div className="flex items-center gap-[1vw] mb-[1.6vh]">
          <div className="h-px w-[3vw] bg-accent" />
          <div className="font-body uppercase tracking-[0.32em] text-[0.85vw] text-accent font-semibold">Three Beliefs</div>
        </div>
        <div className="grid grid-cols-3 gap-x-[1vw] h-[calc(100%-3.8vh)]">
          {tenets.map((t) => (
            <div key={t.eyebrow} className={`relative rounded-2xl ring-1 ${t.ring} bg-bg-elev/40 overflow-hidden`}>
              <div className={`absolute inset-0 bg-gradient-to-b ${t.bg} pointer-events-none`} />
              <div className={`absolute inset-x-0 top-0 h-[3px] ${t.bar}`} />
              <div className="relative p-[1.4vw] flex flex-col h-full">
                <div className={`font-body uppercase tracking-[0.28em] text-[0.85vw] font-semibold ${t.accent}`}>
                  {t.eyebrow}
                </div>
                <div className="font-display text-[1.55vw] leading-tight tracking-tight mt-[1.2vh] text-text">{t.title}</div>
                <div className="font-body text-[0.95vw] text-text/65 mt-[1.6vh] leading-snug">{t.body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute bottom-[5vh] left-[6vw] right-[6vw]">
        <div className="border-t border-text/10 pt-[2vh]">
          <div className="flex items-center gap-[1vw] mb-[1.2vh]">
            <div className="h-px w-[3vw] bg-accent" />
            <div className="font-body uppercase tracking-[0.32em] text-[0.85vw] text-accent font-semibold">The Daily Ritual</div>
          </div>
          <div className="flex items-baseline gap-[2vw] flex-wrap font-display text-[1.45vw] leading-[1.2] tracking-tight">
            <div><span className="text-accent">Morning.</span><span className="text-text/55"> Set your level.</span></div>
            <div className="text-text/30">·</div>
            <div><span className="text-accent">Midday.</span><span className="text-text/55"> Maintain your edge.</span></div>
            <div className="text-text/30">·</div>
            <div><span className="text-accent">Pre-performance.</span><span className="text-text/55"> Lock in.</span></div>
            <div className="text-text/30">·</div>
            <div><span className="text-accent">Recovery.</span><span className="text-text/55"> Reset.</span></div>
          </div>
          <div className="mt-[1.2vh] font-body italic text-[1vw] text-text/55 leading-snug">
            Not used occasionally. <span className="text-text">Built into the day so you're never off.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
