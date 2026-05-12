export default function Methodology() {
  const mix = [
    { label: "Hydration Drinks", pct: 40, why: "RTD volume · retail-led", color: "#5478D5", text: "text-blue" },
    { label: "Hydration Sticks", pct: 25, why: "High-frequency repeat", color: "#E53341", text: "text-primary" },
    { label: "Energy Drinks", pct: 20, why: "Incremental occasions", color: "#F5D637", text: "text-accent" },
    { label: "Canisters", pct: 15, why: "Basket + subscription", color: "#9CA3AF", text: "text-text/70" },
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

      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-blue font-semibold">18 — Unit Economics</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">18 / 24</div>
      </div>

      <div className="absolute top-[12vh] left-[6vw] right-[6vw] flex justify-between items-end gap-[4vw]">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-[1.2vw] mb-[1.4vh]">
            <div className="h-[2px] w-[5vw] bg-blue" />
            <span className="font-body uppercase tracking-[0.32em] text-[1.3vw] text-blue font-semibold">Bottoms-Up Model</span>
          </div>
          <h2 className="font-display text-[4.4vw] leading-[0.92] tracking-tighter">
            How we built <span className="text-blue">the numbers.</span>
          </h2>
        </div>
        <p className="font-body text-[1.05vw] text-text/65 max-w-[24vw] leading-snug pb-[1vh] text-right">
          Every assumption modeled from product pricing up — benchmarked against Liquid I.V., LMNT, and the broader functional beverage category.
        </p>
      </div>

      <div className="absolute top-[34vh] left-[6vw] right-[6vw]">
        <div className="flex items-center gap-[1vw] mb-[1.6vh]">
          <div className="h-px w-[3vw] bg-blue" />
          <div className="font-body uppercase tracking-[0.32em] text-[0.9vw] text-blue font-semibold">Product Mix · Steady-State Blend</div>
        </div>

        <div className="relative w-full h-[5vh] rounded-md overflow-hidden ring-1 ring-text/10 flex">
          {segs.map((s) => (
            <div
              key={s.label}
              className="h-full flex items-center justify-center"
              style={{ width: `${s.pct}%`, background: s.color, opacity: 0.92 }}
            >
              <span className="font-display text-[1.4vw] tracking-tight" style={{ color: s.label === "Energy Drinks" ? "#08080F" : "#fff" }}>
                {s.pct}%
              </span>
            </div>
          ))}
        </div>

        <div className="flex w-full mt-[1.4vh]">
          {mix.map((m) => (
            <div key={m.label} style={{ width: `${m.pct}%` }} className="px-[0.6vw] first:pl-0 last:pr-0">
              <div className={`font-display text-[1.05vw] leading-tight ${m.text}`}>{m.label}</div>
              <div className="font-body text-[0.78vw] text-text/55 mt-[0.4vh] leading-snug">{m.why}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute top-[51vh] bottom-[14vh] left-[6vw] right-[6vw] grid grid-cols-2 gap-[3vw]">
        <div>
          <div className="flex items-center gap-[1vw] mb-[1.6vh]">
            <div className="h-px w-[3vw] bg-primary" />
            <div className="font-body uppercase tracking-[0.32em] text-[0.9vw] text-primary font-semibold">The Unit-Economic Equation</div>
          </div>

          <div className="font-display text-[1.85vw] leading-[1.25] tracking-tight">
            <div>
              <span className="text-text">$52</span>
              <span className="text-text/45 text-[1.1vw]"> AOV</span>
              <span className="text-text/45"> × </span>
              <span className="text-text">5–7×</span>
              <span className="text-text/45 text-[1.1vw]"> /yr</span>
              <span className="text-text/45"> × </span>
              <span className="text-text">65%</span>
              <span className="text-text/45 text-[1.1vw]"> GM</span>
            </div>
            <div className="text-text/45 text-[1.4vw] my-[0.6vh]">=</div>
            <div>
              <span className="text-primary">$383 CLTV</span>
              <span className="text-text/45"> ÷ </span>
              <span className="text-text">$49</span>
              <span className="text-text/45 text-[1.1vw]"> CAC</span>
            </div>
            <div className="text-text/45 text-[1.4vw] my-[0.6vh]">=</div>
            <div>
              <span className="text-primary">5:1</span>
              <span className="text-text/55 text-[1.4vw]"> LTV:CAC</span>
              <span className="text-text/35 text-[1vw]"> · </span>
              <span className="text-accent text-[1.4vw]">21:1 at OS bundle</span>
            </div>
          </div>

          {/* Downside sensitivity — proves we've stress-tested the model */}
          <div className="mt-[2vh] rounded-md border border-text/15 bg-bg-elev/40 px-[1.2vw] py-[1vh]">
            <div className="font-body uppercase tracking-[0.26em] text-[0.7vw] text-text/55 font-semibold">Stress Test · Downside Case</div>
            <div className="font-display text-[1.15vw] leading-tight tracking-tight mt-[0.6vh]">
              <span className="text-text/65">$75 CAC · 4× repeat · 65% GM →</span>{" "}
              <span className="text-text">2.8:1</span>
              <span className="text-text/45 text-[0.95vw]"> LTV:CAC · still venture-grade</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-[3vh]">
          <div>
            <div className="flex items-center gap-[1vw] mb-[1.4vh]">
              <div className="h-px w-[3vw] bg-text/40" />
              <div className="font-body uppercase tracking-[0.32em] text-[0.9vw] text-text/75 font-semibold">Benchmarked Against</div>
            </div>
            <div className="font-display text-[1.4vw] leading-tight text-text">
              Liquid I.V. · LMNT · Functional beverage category
            </div>
            <div className="font-body text-[0.95vw] text-text/65 mt-[1vh] leading-snug">
              Industry CAC range <span className="text-text">$40 – $70</span>. We model <span className="text-text">$49</span> — conservative versus best-in-class, with upside as creator + organic mix scales.
            </div>
          </div>

          <div>
            <div className="flex items-center gap-[1vw] mb-[1.4vh]">
              <div className="h-px w-[3vw] bg-accent" />
              <div className="font-body uppercase tracking-[0.32em] text-[0.9vw] text-accent font-semibold">AForce OS · SaaS Layer</div>
            </div>
            <div className="grid grid-cols-3 gap-[1vw]">
              <div>
                <div className="font-display text-[1.5vw] text-text leading-none">$5 · $15</div>
                <div className="font-body uppercase tracking-[0.22em] text-[0.65vw] text-text/55 mt-[0.6vh]">Monthly tiers</div>
              </div>
              <div>
                <div className="font-display text-[1.5vw] text-text leading-none">2.5–3 yr</div>
                <div className="font-body uppercase tracking-[0.22em] text-[0.65vw] text-text/55 mt-[0.6vh]">Customer lifespan</div>
              </div>
              <div>
                <div className="font-display text-[1.5vw] text-accent leading-none">90%+</div>
                <div className="font-body uppercase tracking-[0.22em] text-[0.65vw] text-text/55 mt-[0.6vh]">Gross margin</div>
              </div>
            </div>
            <div className="font-body text-[0.85vw] text-text/55 mt-[1vh] leading-snug italic">
              Modeled as upside — partial conversion only. Base case does not require it.
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-[5vh] left-[6vw] right-[6vw]">
        <div className="border-t border-text/10 pt-[2vh] flex items-center justify-between gap-[1vw] flex-wrap font-body text-[0.95vw]">
          <span className="font-body uppercase tracking-[0.32em] text-[0.75vw] text-text/45 font-semibold">Build Order</span>
          {[
            "Product pricing",
            "Mix",
            "Frequency",
            "Channel",
            "CAC benchmark",
            "SaaS overlay",
          ].map((step, i, arr) => (
            <span key={step} className="flex items-center gap-[1vw]">
              <span className="text-text">{step}</span>
              {i < arr.length - 1 && <span className="text-text/25">→</span>}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
