export default function Mission() {
  const tenets = [
    {
      eyebrow: "Built for pressure",
      title: "Most products give you a lift. Then they let you fall.",
      body: "AForce is built for the moments that decide everything — when others fade, you stay sharp.",
      accent: "text-accent",
      ring: "ring-accent/35",
      bar: "bg-accent",
      bg: "from-accent/[0.10] to-accent/0",
    },
    {
      eyebrow: "What we believe",
      title: "Performance comes from control, not intensity.",
      body: "Control your body → you control your output. Control your output → you control the outcome.",
      accent: "text-blue",
      ring: "ring-blue/35",
      bar: "bg-blue",
      bg: "from-blue/[0.10] to-blue/0",
    },
    {
      eyebrow: "Who this is for",
      title: "People who expect more from themselves — every day.",
      body: "People who don't guess. People who don't drift. People judged by what they deliver, not what they say.",
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
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-accent font-semibold">02 — Mission</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">02 / 24</div>
      </div>

      <div className="absolute top-[12vh] left-[6vw] right-[6vw] flex justify-between items-end gap-[4vw]">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-[1.2vw] mb-[1.4vh]">
            <div className="h-[2px] w-[5vw] bg-accent" />
            <span className="font-body uppercase tracking-[0.32em] text-[1.3vw] text-accent font-semibold">Mission</span>
          </div>
          <h2 className="font-display text-[4.4vw] leading-[0.95] tracking-tighter">
            Performance is not a goal. <span className="text-accent">It's a standard.</span>
          </h2>
        </div>
        <p className="font-body text-[1.05vw] text-text/65 max-w-[26vw] leading-snug pb-[1vh] text-right">
          <span className="text-text">For people who cannot afford to be off</span> — judged by how they perform, not by what they say.
        </p>
      </div>

      <div className="absolute top-[40vh] bottom-[18vh] left-[6vw] right-[6vw]">
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
                <div className="font-display text-[1.7vw] leading-tight tracking-tight mt-[1.2vh] text-text">{t.title}</div>
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
            <div className="font-body uppercase tracking-[0.32em] text-[0.85vw] text-accent font-semibold">The Loop</div>
          </div>
          <div className="font-display text-[1.7vw] leading-[1.25] tracking-tight">
            <span className="text-text/55">Control your </span>
            <span className="text-text">body.</span>
            <span className="text-text/55"> Control your </span>
            <span className="text-text">output.</span>
            <span className="text-text/55"> Control the </span>
            <span className="text-accent">outcome.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
