export default function NationalMedia() {
  const impacts = [
    {
      num: "01",
      title: "National Brand Visibility",
      body: "Millions of viewers introduced to AForce at the exact moment of launch.",
      accent: "text-accent",
      ring: "ring-accent/35",
      bar: "bg-accent",
      bg: "from-accent/[0.10] to-accent/0",
    },
    {
      num: "02",
      title: "Retail Buyer Awareness",
      body: "Accelerates conversations with major retail buyers seeking momentum brands.",
      accent: "text-blue",
      ring: "ring-blue/35",
      bar: "bg-blue",
      bg: "from-blue/[0.10] to-blue/0",
    },
    {
      num: "03",
      title: "Investor Attention",
      body: "Primetime visibility signals market validation during the early-growth window.",
      accent: "text-primary",
      ring: "ring-primary/35",
      bar: "bg-primary",
      bg: "from-primary/[0.10] to-primary/0",
    },
    {
      num: "04",
      title: "Launch Momentum",
      body: "TV exposure synced with the first production run drives rapid trial and shelf velocity.",
      accent: "text-text",
      ring: "ring-text/25",
      bar: "bg-text/70",
      bg: "from-text/[0.08] to-text/0",
    },
  ];

  const timeline = [
    {
      date: "Spring 2026",
      label: "Launch",
      body: "Product launch + first production run.",
      accent: "text-text",
      dot: "bg-text",
      align: "items-start text-left",
    },
    {
      date: "Summer 2026",
      label: "Filming",
      body: "America's Real Deal Season 2 production wraps.",
      accent: "text-blue",
      dot: "bg-blue",
      align: "items-center text-center",
    },
    {
      date: "Fall 2026",
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
        style={{ background: "radial-gradient(ellipse 60% 50% at 18% 75%, rgba(84,120,213,0.08) 0%, transparent 65%)" }}
      />

      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-accent font-semibold">05 — National Media</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">05 / 26</div>
      </div>

      <div className="absolute top-[12vh] left-[6vw] right-[6vw] flex justify-between items-end gap-[4vw]">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-[1.2vw] mb-[1.4vh]">
            <div className="h-[2px] w-[5vw] bg-accent" />
            <span className="font-body uppercase tracking-[0.32em] text-[1.3vw] text-accent font-semibold">Launch Catalyst</span>
          </div>
          <h2 className="font-display text-[4.8vw] leading-[0.92] tracking-tighter">
            <span className="text-accent">National TV.</span> Synced to launch.
          </h2>
        </div>
        <p className="font-body text-[1.05vw] text-text/65 max-w-[28vw] leading-snug pb-[1vh] text-right">
          AForce selected for <span className="text-text font-semibold">America's Real Deal — Season 2</span>. Nationally distributed on Amazon Prime + syndicated TV. Timed precisely with our Spring 2026 launch.
        </p>
      </div>

      <div className="absolute top-[36vh] left-[6vw] right-[6vw]">
        <div className="flex items-center gap-[1vw] mb-[2.4vh]">
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
                <div className={`font-body uppercase tracking-[0.32em] text-[0.85vw] font-semibold mt-[1.6vh] ${t.accent}`}>
                  {t.date} — {t.label}
                </div>
                <div className="font-body text-[0.95vw] text-text/65 max-w-[24vw] leading-snug mt-[0.6vh]">{t.body}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute top-[60vh] bottom-[16vh] left-[6vw] right-[6vw] grid grid-cols-4 gap-x-[0.9vw]">
        {impacts.map((p) => (
          <div key={p.num} className={`relative rounded-2xl ring-1 ${p.ring} bg-bg-elev/40 overflow-hidden`}>
            <div className={`absolute inset-0 bg-gradient-to-b ${p.bg} pointer-events-none`} />
            <div className={`absolute inset-x-0 top-0 h-[3px] ${p.bar}`} />
            <div className="relative p-[1.2vw] flex flex-col h-full">
              <div className={`font-display text-[1.8vw] leading-none ${p.accent}`}>{p.num}</div>
              <div className="font-display text-[1.3vw] leading-tight text-text mt-[1.4vh]">{p.title}</div>
              <div className="font-body text-[0.88vw] text-text/65 leading-snug mt-[1.2vh]">{p.body}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="absolute bottom-[5vh] left-[6vw] right-[6vw]">
        <div className="border-t border-text/10 pt-[2vh]">
          <div className="flex items-center gap-[1vw] mb-[1.2vh]">
            <div className="h-px w-[3vw] bg-accent" />
            <div className="font-body uppercase tracking-[0.32em] text-[0.85vw] text-accent font-semibold">Perfect Timing</div>
          </div>
          <div className="font-display text-[1.6vw] leading-[1.25] tracking-tight">
            <span className="text-text/55">Spring: </span>
            <span className="text-text">launch</span>
            <span className="text-text/55">. Fall: </span>
            <span className="text-accent">primetime</span>
            <span className="text-text/55">. The two events compound — visibility lands the moment shelves stock.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
