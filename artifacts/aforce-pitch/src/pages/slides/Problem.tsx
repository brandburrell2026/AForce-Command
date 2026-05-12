export default function Problem() {
  const failures = [
    {
      label: "The Loud Category",
      title: "Stimulation. Hype. Speed.",
      tags: ["External energy", "Spike & crash", "Built for moments"],
      body: "Red Bull is the clearest example — the category is loud by design. It captures attention with intensity, then leaves the body to absorb the fall.",
      accent: "text-primary",
      ring: "ring-primary/35",
      bar: "bg-primary",
      bg: "from-primary/[0.10] to-primary/0",
      shelf: "Red Bull · Monster · Celsius · Prime",
    },
    {
      label: "The Empty Default",
      title: "Water alone. No system.",
      tags: ["No measurement", "No feedback", "No compounding"],
      body: "Plain water helps but never closes the loop. Nothing measures the body, nothing adjusts, nothing repeats. Performance is left to chance.",
      accent: "text-text/75",
      ring: "ring-text/25",
      bar: "bg-text/40",
      bg: "from-text/[0.06] to-text/0",
      shelf: "Every gym fountain in America",
    },
  ];

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 65% 55% at 18% 30%, rgba(229,51,65,0.12) 0%, transparent 65%)" }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 60% 50% at 85% 80%, rgba(140,140,158,0.08) 0%, transparent 65%)" }}
      />

      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-primary font-semibold">04 — Problem</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">4 / 24</div>
      </div>

      <div className="absolute top-[12vh] left-[6vw] right-[6vw] flex justify-between items-end gap-[4vw]">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-[1.2vw] mb-[1.4vh]">
            <div className="h-[2px] w-[5vw] bg-primary" />
            <span className="font-body uppercase tracking-[0.32em] text-[1.3vw] text-primary font-semibold">The Disruption</span>
          </div>
          <h2 className="font-display text-[4.4vw] leading-[0.95] tracking-tighter text-balance">
            Every other brand shows up <span className="text-primary">after</span> performance breaks down.
          </h2>
        </div>
        <p className="font-body text-[1.05vw] text-text/65 max-w-[26vw] leading-snug pb-[1vh] text-right">
          <span className="text-text">The category captures peaks.</span> Stimulation, hype, recovery after the fact. Nothing operates <span className="text-text">before</span> the moment that decides everything.
        </p>
      </div>

      <div className="absolute top-[40vh] bottom-[16vh] left-[6vw] right-[6vw] grid grid-cols-2 gap-[2vw]">
        {failures.map((f) => (
          <div key={f.label} className={`relative rounded-2xl ring-1 ${f.ring} bg-bg-elev/45 overflow-hidden`}>
            <div className={`absolute inset-0 bg-gradient-to-b ${f.bg} pointer-events-none`} />
            <div className={`absolute inset-x-0 top-0 h-[3px] ${f.bar}`} />
            <div className="relative p-[1.8vw] flex flex-col h-full">
              <div className={`font-body uppercase tracking-[0.32em] text-[0.95vw] font-semibold ${f.accent}`}>{f.label}</div>
              <div className="font-display text-[3vw] leading-none tracking-tight text-text mt-[1.4vh]">{f.title}</div>

              <div className="flex flex-wrap gap-[0.6vw] mt-[2.2vh]">
                {f.tags.map((tag) => (
                  <span
                    key={tag}
                    className={`px-[1vw] py-[0.5vh] rounded-full ring-1 ${f.ring} font-body text-[0.85vw] ${f.accent}`}
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <div className="font-body text-[1vw] text-text/70 mt-[2vh] leading-snug">{f.body}</div>

              <div className="mt-auto pt-[2vh] border-t border-text/10">
                <div className="font-body uppercase tracking-[0.22em] text-[0.65vw] text-text/45 font-semibold mb-[0.6vh]">On the shelf</div>
                <div className={`font-body text-[0.9vw] ${f.accent}`}>{f.shelf}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="absolute bottom-[5vh] left-[6vw] right-[6vw]">
        <div className="border-t border-text/10 pt-[2vh]">
          <div className="flex items-center gap-[1vw] mb-[1.2vh]">
            <div className="h-px w-[3vw] bg-primary" />
            <div className="font-body uppercase tracking-[0.32em] text-[0.85vw] text-primary font-semibold">AForce does something fundamentally different</div>
          </div>
          <div className="font-display text-[1.55vw] leading-[1.25] tracking-tight">
            <span className="text-text">It removes noise. </span>
            <span className="text-text">It removes friction. </span>
            <span className="text-primary">It creates clarity. </span>
            <span className="text-text/65">It prepares you for performance.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
