export default function Insight() {
  const tenets = [
    {
      label: "Buffer",
      title: "Support recovery.",
      body: "Alkaline mineral content complements the body's natural buffer after hard effort — so the next set starts fresh.",
      accent: "text-primary",
      ring: "ring-primary/35",
      bar: "bg-primary",
      bg: "from-primary/[0.10] to-primary/0",
    },
    {
      label: "Restore",
      title: "Mineral matrix.",
      body: "Sea-derived ingredients carry electrolytes and trace minerals in their natural form — no synthetic shortcuts, no fillers.",
      accent: "text-blue",
      ring: "ring-blue/35",
      bar: "bg-blue",
      bg: "from-blue/[0.10] to-blue/0",
    },
    {
      label: "Hold",
      title: "Built to ride longer.",
      body: "No added sugar — designed to keep you in the work, not chasing a crash thirty minutes later.",
      accent: "text-accent",
      ring: "ring-accent/35",
      bar: "bg-accent",
      bg: "from-accent/[0.10] to-accent/0",
    },
  ];

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 60% 50% at 82% 25%, rgba(245,214,55,0.14) 0%, transparent 65%)" }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 60% 50% at 18% 75%, rgba(229,51,65,0.10) 0%, transparent 65%)" }}
      />

      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-accent font-semibold">04 — Insight</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">04 / 27</div>
      </div>

      <div className="absolute top-[12vh] left-[6vw] right-[6vw] flex justify-between items-end gap-[4vw]">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-[1.2vw] mb-[1.4vh]">
            <div className="h-[2px] w-[5vw] bg-accent" />
            <span className="font-body uppercase tracking-[0.32em] text-[1.3vw] text-accent font-semibold">Insight</span>
          </div>
          <h2 className="font-display text-[5vw] leading-[0.92] tracking-tighter">
            Performance lives in the <span className="text-accent">buffer.</span>
          </h2>
        </div>
        <p className="font-body text-[1.05vw] text-text/65 max-w-[26vw] leading-snug pb-[1vh] text-right">
          <span className="text-text">Most drinks fight the body. AForce works with it.</span> pH 8.8 is where the buffer lives — and where output gets held.
        </p>
      </div>

      <div className="absolute top-[37vh] left-[6vw] right-[6vw]">
        <div className="flex items-center gap-[1vw] mb-[2vh]">
          <div className="h-px w-[3vw] bg-accent" />
          <div className="font-body uppercase tracking-[0.32em] text-[0.85vw] text-accent font-semibold">pH Scale · Buffer Zone</div>
        </div>
        <div className="grid grid-cols-9 gap-[0.5vw] mb-[1.6vh] items-end">
          <div className="h-[2vh] bg-primary rounded-sm" />
          <div className="h-[2vh] bg-primary/80 rounded-sm" />
          <div className="h-[2vh] bg-primary/60 rounded-sm" />
          <div className="h-[2vh] bg-primary/40 rounded-sm" />
          <div className="h-[2vh] bg-text/30 rounded-sm" />
          <div className="h-[2vh] bg-blue/40 rounded-sm" />
          <div className="h-[2vh] bg-blue/60 rounded-sm" />
          <div className="h-[2vh] bg-blue/85 rounded-sm" />
          <div className="h-[3vh] bg-accent rounded-sm relative">
            <div className="absolute -top-[3.4vh] left-1/2 -translate-x-1/2 font-display text-[1.6vw] text-accent leading-none">8.8</div>
          </div>
        </div>
        <div className="flex justify-between font-body uppercase tracking-[0.3em] text-[0.95vw] text-muted">
          <span>pH 1 — Acidic</span>
          <span>Neutral</span>
          <span className="text-accent">pH 8.8 — AForce</span>
        </div>
      </div>

      <div className="absolute top-[57vh] bottom-[16vh] left-[6vw] right-[6vw] grid grid-cols-3 gap-x-[1vw]">
        {tenets.map((t) => (
          <div key={t.label} className={`relative rounded-2xl ring-1 ${t.ring} bg-bg-elev/40 overflow-hidden`}>
            <div className={`absolute inset-0 bg-gradient-to-b ${t.bg} pointer-events-none`} />
            <div className={`absolute inset-x-0 top-0 h-[3px] ${t.bar}`} />
            <div className="relative p-[1.4vw] flex flex-col h-full">
              <div className={`font-body uppercase tracking-[0.32em] text-[0.95vw] font-semibold ${t.accent}`}>{t.label}</div>
              <div className="font-display text-[2vw] leading-tight tracking-tight text-text mt-[1.4vh]">{t.title}</div>
              <div className="font-body text-[0.95vw] text-text/65 mt-[1.6vh] leading-snug">{t.body}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="absolute bottom-[5vh] left-[6vw] right-[6vw]">
        <div className="border-t border-text/10 pt-[2vh]">
          <div className="flex items-center gap-[1vw] mb-[1.2vh]">
            <div className="h-px w-[3vw] bg-accent" />
            <div className="font-body uppercase tracking-[0.32em] text-[0.85vw] text-accent font-semibold">Why 8.8</div>
          </div>
          <div className="font-display text-[1.7vw] leading-[1.25] tracking-tight">
            <span className="text-text/55">Acidic drinks tax the buffer. </span>
            <span className="text-text">Alkaline restores it.</span>
            <span className="text-text/55"> 8.8 is the difference between </span>
            <span className="text-accent">finishing and crashing.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
