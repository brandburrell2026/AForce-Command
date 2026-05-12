export default function Market() {
  const segments = [
    {
      label: "Functional Beverages",
      amount: "$200B+",
      tag: "Fastest growing",
      body: "Consumers want cleaner functional fuel. Premium hydration leads it — clean labels, function over flavor.",
      capture: "Clean-label, mineral-dense formulation",
      accent: "text-primary",
      ring: "ring-primary/35",
      bar: "bg-primary",
      bg: "from-primary/[0.10] to-primary/0",
    },
    {
      label: "Sports Drinks",
      amount: "$30B+",
      tag: "Wide open at the top",
      body: "Athletes and high-output users want performance without the crash. The clean, alkaline end is wide open.",
      capture: "Performance use case, no sugar, alkaline base",
      accent: "text-blue",
      ring: "ring-blue/35",
      bar: "bg-blue",
      bg: "from-blue/[0.10] to-blue/0",
    },
    {
      label: "Hydration Mixes",
      amount: "$5B+",
      tag: "Exploding category",
      body: "Convenience is rising, but intelligence is missing. No alkaline, sea-functional player operates here at scale.",
      capture: "Stick-mix convenience + functional formula",
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
        style={{ background: "radial-gradient(ellipse 50% 45% at 18% 30%, rgba(229,51,65,0.10) 0%, transparent 65%)" }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 50% 45% at 50% 65%, rgba(84,120,213,0.10) 0%, transparent 65%)" }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 50% 45% at 82% 25%, rgba(245,214,55,0.10) 0%, transparent 65%)" }}
      />

      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-accent font-semibold">12 — Market</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">12 / 24</div>
      </div>

      <div className="absolute top-[12vh] left-[6vw] right-[6vw] flex justify-between items-end gap-[4vw]">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-[1.2vw] mb-[1.4vh]">
            <div className="h-[2px] w-[5vw] bg-accent" />
            <span className="font-body uppercase tracking-[0.32em] text-[1.3vw] text-accent font-semibold">Market</span>
          </div>
          <h2 className="font-display text-[5.2vw] leading-[0.92] tracking-tighter">
            The performance <span className="text-accent">economy.</span>
          </h2>
        </div>
        <p className="font-body text-[1.05vw] text-text/65 max-w-[28vw] leading-snug pb-[1vh] text-right">
          <span className="text-text">Functional beverages, sports drinks, and hydration mixes are converging into one demand:</span> sustained performance.
        </p>
      </div>

      <div className="absolute top-[46vh] bottom-[16vh] left-[6vw] right-[6vw] grid grid-cols-3 gap-[1.4vw]">
        {segments.map((s) => (
          <div key={s.label} className={`relative rounded-2xl ring-1 ${s.ring} bg-bg-elev/40 overflow-hidden`}>
            <div className={`absolute inset-0 bg-gradient-to-b ${s.bg} pointer-events-none`} />
            <div className={`absolute inset-x-0 top-0 h-[3px] ${s.bar}`} />
            <div className="relative p-[1.6vw] flex flex-col h-full">
              <div className={`font-body uppercase tracking-[0.32em] text-[0.95vw] font-semibold ${s.accent}`}>{s.label}</div>
              <div className={`font-display text-[5vw] leading-none tracking-tighter mt-[1.4vh] ${s.accent}`}>{s.amount}</div>
              <div className={`self-start mt-[1.6vh] px-[0.9vw] py-[0.4vh] rounded-full ring-1 ${s.ring} font-body text-[0.78vw] uppercase tracking-[0.22em] font-semibold ${s.accent}`}>
                {s.tag}
              </div>
              <div className="font-body text-[1vw] text-text/70 mt-[2vh] leading-snug">{s.body}</div>

              <div className="mt-auto pt-[2vh] border-t border-text/10">
                <div className="font-body uppercase tracking-[0.22em] text-[0.65vw] text-text/45 font-semibold mb-[0.6vh]">AForce captures</div>
                <div className={`font-body text-[0.9vw] ${s.accent}`}>{s.capture}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="absolute bottom-[5vh] left-[6vw] right-[6vw]">
        <div className="border-t border-text/10 pt-[2vh]">
          <div className="flex items-center gap-[1vw] mb-[1.2vh]">
            <div className="h-px w-[3vw] bg-accent" />
            <div className="font-body uppercase tracking-[0.32em] text-[0.85vw] text-accent font-semibold">The Intersection</div>
          </div>
          <div className="font-display text-[1.6vw] leading-[1.25] tracking-tight">
            <span className="text-text/55">AForce sits at the intersection of </span>
            <span className="text-text">product, behavior, and data.</span>
            <span className="text-text/55"> Functional formula · sports use case · stick convenience — </span>
            <span className="text-accent">$235B+ at the intersection.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
