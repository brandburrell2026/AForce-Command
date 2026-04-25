export default function Financials() {
  const revenue = [
    { year: "2026", value: 3.2 },
    { year: "2027", value: 13 },
    { year: "2028", value: 27.8 },
  ];
  const ebitda = [
    { year: "2026", value: -1.5 },
    { year: "2027", value: -1.2 },
    { year: "2028", value: 2.1 },
  ];
  const revMax = 30;
  const ebitMin = -2;
  const ebitMax = 3;
  const ebitRange = ebitMax - ebitMin;

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-blue font-semibold">19 — Financial Projections</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">19 / 22</div>
      </div>

      <div className="absolute top-[12vh] left-[6vw] right-[6vw] flex justify-between items-end gap-[3vw]">
        <h2 className="font-display text-[3.6vw] leading-[1] tracking-tighter text-balance max-w-[58vw]">
          Financial projections — <span className="text-blue">2026–2028.</span>
        </h2>
        <p className="font-body text-[1.05vw] text-text/70 max-w-[36vw] leading-snug pb-[0.4vh]">
          AForce is projected to scale from <span className="text-text font-semibold">$3.2M in 2026</span> to <span className="text-text font-semibold">$27.8M in 2028</span>, reaching EBITDA breakeven in late 2027. Revenue begins immediately upon launch, aligned ahead of national TV exposure in Summer 2026.
        </p>
      </div>

      <div className="absolute top-[26vh] left-[6vw] right-[6vw] grid grid-cols-2 gap-[3vw]">
        <div className="bg-bg-elev rounded-lg p-[1.6vw] border border-text/10">
          <div className="font-body uppercase tracking-[0.25em] text-[1vw] text-muted mb-[2vh]">Revenue Growth ($M)</div>
          <div className="flex items-end justify-around h-[18vh] gap-[1.4vw] px-[1vw]">
            {revenue.map((r) => (
              <div key={r.year} className="flex-1 flex flex-col items-center">
                <div className="font-display text-[1.4vw] text-blue mb-[0.6vh]">${r.value}M</div>
                <div className="w-full bg-blue/30 rounded-t" style={{ height: `${(r.value / revMax) * 100}%`, minHeight: "4px" }} />
                <div className="font-body text-[1vw] text-text/70 mt-[1vh]">{r.year}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-bg-elev rounded-lg p-[1.6vw] border border-text/10">
          <div className="font-body uppercase tracking-[0.25em] text-[1vw] text-muted mb-[2vh]">EBITDA Path ($M)</div>
          <div className="relative h-[18vh] flex items-end justify-around gap-[1.4vw] px-[1vw]">
            <div
              className="absolute left-[1vw] right-[1vw] h-[1px] bg-text/20"
              style={{ bottom: `${((0 - ebitMin) / ebitRange) * 100}%` }}
            />
            {ebitda.map((e) => {
              const positive = e.value >= 0;
              const height = (Math.abs(e.value) / ebitRange) * 100;
              const baseFromBottom = ((0 - ebitMin) / ebitRange) * 100;
              return (
                <div key={e.year} className="flex-1 flex flex-col items-center relative h-full">
                  <div className="absolute left-1/2 -translate-x-1/2 font-display text-[1.2vw]" style={{
                    bottom: positive ? `${baseFromBottom + height + 2}%` : `${baseFromBottom - height - 8}%`,
                    color: positive ? "#5478D5" : "#E53341",
                  }}>{positive ? "+" : ""}{e.value}M</div>
                  <div
                    className={`absolute left-[20%] right-[20%] rounded ${positive ? "bg-blue/40" : "bg-primary/40"}`}
                    style={{
                      bottom: positive ? `${baseFromBottom}%` : `${baseFromBottom - height}%`,
                      height: `${height}%`,
                    }}
                  />
                  <div className="absolute bottom-[-3vh] left-0 right-0 text-center font-body text-[1vw] text-text/70">{e.year}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="absolute bottom-[6vh] left-[6vw] right-[6vw] bg-bg-elev rounded-lg border border-text/10 overflow-hidden">
        <div className="grid grid-cols-4 px-[1.6vw] py-[1.2vh] border-b border-text/10 font-body uppercase tracking-[0.22em] text-[0.95vw]">
          <div className="text-blue">Margin Metric</div>
          <div className="text-center text-muted">2026</div>
          <div className="text-center text-muted">2027</div>
          <div className="text-center text-muted">2028</div>
        </div>
        {[
          ["Gross Margin", "58%", "60%", "62%"],
          ["Contribution Margin", "28%", "35%", "42%"],
          ["CAC Payback", "6–8 months", "5–6 months", "4–5 months"],
        ].map(([m, a, b, c], i, arr) => (
          <div key={i} className={`grid grid-cols-4 px-[1.6vw] py-[1.4vh] font-body text-[1.2vw] ${i < arr.length - 1 ? "border-b border-text/5" : ""}`}>
            <div className="text-text/85">{m}</div>
            <div className="text-center text-text/85">{a}</div>
            <div className="text-center text-text/85">{b}</div>
            <div className="text-center text-text/85">{c}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
