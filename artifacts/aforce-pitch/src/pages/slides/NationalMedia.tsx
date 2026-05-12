export default function NationalMedia() {
  const impacts = [
    {
      num: "01",
      title: "Millions see real performance in real time",
      body: "National broadcast turns the launch moment into live proof — the product, the founders, the system, watched as it happens.",
      accent: "text-accent",
      ring: "ring-accent/35",
      bar: "bg-accent",
      bg: "from-accent/[0.10] to-accent/0",
    },
    {
      num: "02",
      title: "Buyers don't hear a pitch — they see demand",
      body: "Major retailers don't get a story. They get a category appearing on TV the same week the product hits shelves.",
      accent: "text-blue",
      ring: "ring-blue/35",
      bar: "bg-blue",
      bg: "from-blue/[0.10] to-blue/0",
    },
    {
      num: "03",
      title: "Investors don't imagine growth — they watch it",
      body: "Capital meets visibility. The raise window aligns with primetime — traction is observable, not projected.",
      accent: "text-primary",
      ring: "ring-primary/35",
      bar: "bg-primary",
      bg: "from-primary/[0.10] to-primary/0",
    },
    {
      num: "04",
      title: "Shelf velocity starts before retail expansion",
      body: "Trial accelerates from day one. Demand outpaces footprint — the signal retail buyers are built to react to.",
      accent: "text-text",
      ring: "ring-text/25",
      bar: "bg-text/70",
      bg: "from-text/[0.08] to-text/0",
    },
  ];

  const timeline = [
    {
      date: "Summer 2026",
      label: "Launch",
      body: "Product launch + first production run.",
      accent: "text-text",
      dot: "bg-text",
      align: "items-start text-left",
    },
    {
      date: "Fall 2026",
      label: "Filming",
      body: "America's Real Deal Season 2 production wraps.",
      accent: "text-blue",
      dot: "bg-blue",
      align: "items-center text-center",
    },
    {
      date: "Spring 2027",
      label: "Peak",
      body: "National broadcast on Amazon Prime + syndicated TV.",
      accent: "text-accent",
      dot: "bg-accent",
      align: "items-end text-right",
    },
  ];

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 60% 50% at 80% 25%, rgba(245,214,55,0.16) 0%, transparent 65%)" }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 60% 50% at 18% 75%, rgba(229,51,65,0.10) 0%, transparent 65%)" }}
      />

      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-accent font-semibold">05 — Timing</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">5 / 23</div>
      </div>

      <div className="absolute top-[12vh] left-[6vw] right-[6vw]">
        <div className="flex items-center gap-[1.2vw] mb-[1.4vh]">
          <div className="h-[2px] w-[5vw] bg-accent" />
          <span className="font-body uppercase tracking-[0.32em] text-[1.3vw] text-accent font-semibold">Launch Catalyst</span>
        </div>
        <h2 className="font-display text-[3.8vw] leading-[0.96] tracking-tighter text-balance">
          We launch <span className="text-primary">under pressure</span>, <span className="text-text/55">not in theory.</span>
        </h2>
        <div className="mt-[1.4vh] font-body uppercase tracking-[0.28em] text-[1vw] font-semibold text-text/85">
          Two founders. <span className="text-primary">Real pressure.</span> <span className="text-accent">National stage.</span>
        </div>
      </div>

      <div className="absolute top-[34vh] left-[6vw] right-[6vw] flex items-start gap-[1.4vw]">
        <div className="font-display text-[3.6vw] leading-[0.7] text-primary/80 select-none -mt-[0.2vh] shrink-0">"</div>
        <div className="font-display text-[2.2vw] leading-[1.12] tracking-tight text-text max-w-[80vw]">
          We didn't start with a product. We started with a problem we lived <span className="text-primary">under pressure.</span>
        </div>
      </div>

      <div className="absolute top-[48vh] left-[6vw] right-[6vw]">
        <div className="flex items-center gap-[1vw] mb-[2vh]">
          <div className="h-px w-[3vw] bg-accent" />
          <div className="font-body uppercase tracking-[0.32em] text-[0.85vw] text-accent font-semibold">Timeline · 2026</div>
        </div>
        <div className="relative">
          <div
            className="absolute top-[0.7vw] left-[8%] right-[8%] h-[2px]"
            style={{ background: "linear-gradient(to right, rgba(255,255,255,0.4) 0%, rgba(84,120,213,0.7) 50%, rgba(245,214,55,1) 100%)" }}
          />
          <div className="grid grid-cols-3 relative">
            {timeline.map((t) => (
              <div key={t.date} className={`flex flex-col ${t.align}`}>
                <div className={`w-[1.4vw] h-[1.4vw] rounded-full ${t.dot} ring-4 ring-bg`} />
                <div className={`font-body uppercase tracking-[0.32em] text-[0.85vw] font-semibold mt-[1.4vh] ${t.accent}`}>
                  {t.date} — {t.label}
                </div>
                <div className="font-body text-[0.9vw] text-text/65 max-w-[24vw] leading-snug mt-[0.5vh]">{t.body}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute top-[63vh] bottom-[14vh] left-[6vw] right-[6vw] grid grid-cols-4 gap-x-[0.9vw]">
        {impacts.map((p) => (
          <div key={p.num} className={`relative rounded-2xl ring-1 ${p.ring} bg-bg-elev/40 overflow-hidden`}>
            <div className={`absolute inset-0 bg-gradient-to-b ${p.bg} pointer-events-none`} />
            <div className={`absolute inset-x-0 top-0 h-[3px] ${p.bar}`} />
            <div className="relative p-[1.1vw] flex flex-col h-full">
              <div className={`font-display text-[1.7vw] leading-none ${p.accent}`}>{p.num}</div>
              <div className="font-display text-[1.15vw] leading-tight text-text mt-[1.2vh]">{p.title}</div>
              <div className="font-body text-[0.85vw] text-text/65 leading-snug mt-[1vh]">{p.body}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="absolute bottom-[4vh] left-[6vw] right-[6vw]">
        <div className="border-t border-text/10 pt-[1.6vh]">
          <div className="flex items-center gap-[1vw] mb-[1vh]">
            <div className="h-px w-[3vw] bg-primary" />
            <div className="font-body uppercase tracking-[0.32em] text-[0.85vw] text-primary font-semibold">The Catch</div>
          </div>
          <div className="font-display text-[1.8vw] leading-[1.2] tracking-tight">
            <span className="text-text">Demand is </span>
            <span className="text-accent">created publicly.</span>
            <span className="text-text/55"> Captured </span>
            <span className="text-primary">immediately.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
