export default function Methodology() {
  const mix = [
    { label: "Hydration Drinks", pct: 40, why: "RTD volume · retail-led", color: "#5478D5", text: "text-blue" },
    { label: "Hydration Sticks", pct: 25, why: "High-frequency repeat", color: "#E53341", text: "text-primary" },
    { label: "Energy Drinks", pct: 20, why: "Incremental occasions", color: "#F5D637", text: "text-accent" },
    { label: "Canisters", pct: 15, why: "Basket + subscription", color: "#9CA3AF", text: "text-text/70" },
  ];

  const benchmarks = [
    {
      brand: "Liquid I.V.",
      freq: "6–8× / yr",
      cac: "$45 – $65",
      note: "Unilever acquisition disclosures · DTC repeat cohort",
    },
    {
      brand: "LMNT",
      freq: "7–10× / yr",
      cac: "$38 – $55",
      note: "Subscription-led model · 80%+ revenue from repeat",
    },
    {
      brand: "Athletic Greens / AG1",
      freq: "12× / yr",
      cac: "$90 – $130",
      note: "Subscription-only · high CAC justified by LTV",
    },
    {
      brand: "AForce (modeled)",
      freq: "5–7× / yr",
      cac: "$49",
      note: "Conservative vs. category. OS subscription increases retention.",
      highlight: true,
    },
  ];

  let cum = 0;
  const segs = mix.map((m) => {
    const x = cum;
    cum += m.pct;
    return { ...m, x };
  });

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 65% 50% at 20% 25%, rgba(84,120,213,0.16) 0%, transparent 65%)" }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 50% 45% at 85% 80%, rgba(229,51,65,0.07) 0%, transparent 70%)" }}
      />

      <div className="absolute top-[5vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-blue font-semibold">17 — Unit Economics</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">17 / 22</div>
      </div>

      <div className="absolute top-[10vh] left-[6vw] right-[6vw] flex justify-between items-end gap-[4vw]">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-[1.2vw] mb-[1vh]">
            <div className="h-[2px] w-[4vw] bg-blue" />
            <span className="font-body uppercase tracking-[0.32em] text-[0.9vw] text-blue font-semibold">Bottoms-Up Model · Benchmarked Against Observed Category Data</span>
          </div>
          <h2 className="font-display text-[3.2vw] leading-[0.95] tracking-tighter whitespace-nowrap">
            Numbers built on <span className="text-blue">real benchmarks.</span>
          </h2>
        </div>
        <p className="font-body text-[0.85vw] text-text/65 max-w-[22vw] leading-snug pb-[0.6vh] text-right">
          Every assumption modeled from product pricing up — benchmarked against Liquid I.V., LMNT, and AG1.
        </p>
      </div>

      {/* Product mix bar */}
      <div className="absolute top-[24vh] left-[6vw] right-[6vw]">
        <div className="flex items-center gap-[1vw] mb-[1.2vh]">
          <div className="h-px w-[3vw] bg-blue" />
          <div className="font-body uppercase tracking-[0.32em] text-[0.85vw] text-blue font-semibold">Product Mix · Steady-State Blend</div>
        </div>

        <div className="relative w-full h-[4vh] rounded-md overflow-hidden ring-1 ring-text/10 flex">
          {segs.map((s) => (
            <div
              key={s.label}
              className="h-full flex items-center justify-center"
              style={{ width: `${s.pct}%`, background: s.color, opacity: 0.92 }}
            >
              <span className="font-display text-[1.2vw] tracking-tight" style={{ color: s.label === "Energy Drinks" ? "#08080F" : "#fff" }}>
                {s.pct}%
              </span>
            </div>
          ))}
        </div>

        <div className="flex w-full mt-[1vh]">
          {mix.map((m) => (
            <div key={m.label} style={{ width: `${m.pct}%` }} className="px-[0.6vw] first:pl-0 last:pr-0">
              <div className={`font-display text-[0.95vw] leading-tight ${m.text}`}>{m.label}</div>
              <div className="font-body text-[0.7vw] text-text/55 mt-[0.3vh] leading-snug">{m.why}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Equation + Benchmarks */}
      <div className="absolute top-[42vh] bottom-[10vh] left-[6vw] right-[6vw] grid grid-cols-2 gap-[2.4vw]">
        {/* LEFT — equation + stress test */}
        <div>
          <div className="flex items-center gap-[1vw] mb-[1.2vh]">
            <div className="h-px w-[3vw] bg-primary" />
            <div className="font-body uppercase tracking-[0.32em] text-[0.85vw] text-primary font-semibold">The Unit-Economic Equation</div>
          </div>

          <div className="font-display text-[1.55vw] leading-[1.25] tracking-tight">
            <div>
              <span className="text-text">$52</span>
              <span className="text-text/45 text-[0.95vw]"> AOV</span>
              <span className="text-text/45"> × </span>
              <span className="text-text">5–7×</span>
              <span className="text-text/45 text-[0.95vw]"> /yr</span>
              <span className="text-text/45"> × </span>
              <span className="text-text">65%</span>
              <span className="text-text/45 text-[0.95vw]"> GM</span>
            </div>
            <div className="text-text/45 text-[1.2vw] my-[0.4vh]">=</div>
            <div>
              <span className="text-primary">$383 CLTV</span>
              <span className="text-text/45"> ÷ </span>
              <span className="text-text">$49</span>
              <span className="text-text/45 text-[0.95vw]"> CAC</span>
            </div>
            <div className="text-text/45 text-[1.2vw] my-[0.4vh]">=</div>
            <div>
              <span className="text-primary">5:1</span>
              <span className="text-text/55 text-[1.2vw]"> LTV:CAC</span>
              <span className="text-text/35 text-[0.9vw]"> · </span>
              <span className="text-accent text-[1.2vw]">21:1 at OS bundle</span>
            </div>
          </div>

          <div className="mt-[1.6vh] rounded-md border border-text/15 bg-bg-elev/40 px-[1.1vw] py-[0.9vh]">
            <div className="font-body uppercase tracking-[0.26em] text-[0.65vw] text-text/55 font-semibold">Stress Test · Downside Case</div>
            <div className="font-display text-[1.05vw] leading-tight tracking-tight mt-[0.4vh]">
              <span className="text-text/65">$75 CAC · 4× repeat · 65% GM →</span>{" "}
              <span className="text-text">2.8:1</span>
              <span className="text-text/45 text-[0.85vw]"> LTV:CAC · still venture-grade</span>
            </div>
          </div>

          <div className="mt-[1.6vh] rounded-md border border-accent/30 bg-accent/[0.04] px-[1.1vw] py-[0.9vh]">
            <div className="font-body uppercase tracking-[0.26em] text-[0.65vw] text-accent font-semibold">AForce OS · SaaS Layer (Upside)</div>
            <div className="font-body text-[0.82vw] text-text/75 leading-snug mt-[0.4vh]">
              <span className="text-text">$5 / $15 mo tiers · 2.5–3 yr lifespan · 90%+ GM.</span> Modeled as upside — partial conversion only. Base case does not require it.
            </div>
          </div>
        </div>

        {/* RIGHT — repeat purchase benchmark grid */}
        <div>
          <div className="flex items-center gap-[1vw] mb-[1.2vh]">
            <div className="h-px w-[3vw] bg-text/40" />
            <div className="font-body uppercase tracking-[0.32em] text-[0.85vw] text-text/75 font-semibold">Repeat Purchase Assumption · Benchmarked</div>
          </div>

          <div className="rounded-md ring-1 ring-text/10 overflow-hidden">
            {/* Header row */}
            <div className="grid grid-cols-[1.3fr_0.9fr_0.9fr] gap-[0.6vw] bg-bg-elev/60 px-[1vw] py-[0.7vh] border-b border-text/10">
              <div className="font-body uppercase tracking-[0.22em] text-[0.6vw] text-text/55 font-semibold">Brand</div>
              <div className="font-body uppercase tracking-[0.22em] text-[0.6vw] text-text/55 font-semibold">Frequency</div>
              <div className="font-body uppercase tracking-[0.22em] text-[0.6vw] text-text/55 font-semibold">CAC</div>
            </div>

            {benchmarks.map((b) => (
              <div
                key={b.brand}
                className={`grid grid-cols-[1.3fr_0.9fr_0.9fr] gap-[0.6vw] px-[1vw] py-[0.9vh] border-b border-text/8 last:border-0 ${
                  b.highlight ? "bg-primary/[0.06]" : ""
                }`}
              >
                <div>
                  <div className={`font-display text-[1vw] leading-tight tracking-tight ${b.highlight ? "text-primary" : "text-text"}`}>
                    {b.brand}
                  </div>
                  <div className="font-body text-[0.65vw] text-text/50 leading-snug mt-[0.3vh]">{b.note}</div>
                </div>
                <div className="font-display text-[1.05vw] text-text leading-none self-start mt-[0.2vh]">{b.freq}</div>
                <div className="font-display text-[1.05vw] text-text leading-none self-start mt-[0.2vh]">{b.cac}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute bottom-[2.5vh] left-[6vw] right-[6vw]">
        <div className="border-t border-text/10 pt-[1.2vh] flex items-baseline justify-between gap-[2vw]">
          <div className="font-display text-[1.3vw] leading-tight tracking-tight">
            <span className="text-text/55">AForce models </span>
            <span className="text-text">conservative against the category.</span>
            <span className="text-text/55"> The OS bundle is upside, </span>
            <span className="text-primary">not a requirement.</span>
          </div>
          <div className="font-body text-[0.7vw] text-text/45 italic max-w-[28vw] text-right leading-snug">
            Sources: Unilever investor disclosures · LMNT public statements · AG1 / Athletic Greens disclosed metrics
          </div>
        </div>
      </div>
    </div>
  );
}
