import SlideChrome from "@/components/SlideChrome";

const MONTHS = [
  { m: "M1", revenue: 8 },
  { m: "M3", revenue: 14 },
  { m: "M5", revenue: 24 },
  { m: "M7", revenue: 38 },
  { m: "M9", revenue: 56 },
  { m: "M12", revenue: 82 },
  { m: "M15", revenue: 110 },
  { m: "M18", revenue: 142 },
];

export default function FinancialModel() {
  const max = Math.max(...MONTHS.map((m) => m.revenue));
  const breakevenIdx = 4;
  return (
    <SlideChrome slide={23}>
      <div className="absolute inset-0 flex flex-col justify-center px-[8vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          Financial Model
        </div>

        <h2 className="font-display text-[4.4vw] leading-[0.95] tracking-tighter max-w-[70vw] mb-[2vh]">
          Growth curve. <span className="text-text/45">Clean.</span>
        </h2>
        <div className="font-display text-[1.3vw] leading-[1.2] tracking-tight text-text/55 max-w-[55vw]">
          18-month model. Breakeven by month 5.
        </div>

        <div className="mt-[6vh] relative h-[36vh] max-w-[78vw] w-full">
          <div className="absolute inset-0 grid grid-rows-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="border-t border-text/8" />
            ))}
          </div>

          <div className="absolute inset-0 flex items-end gap-[1vw]">
            {MONTHS.map((m, i) => {
              const h = (m.revenue / max) * 100;
              const isBreakeven = i === breakevenIdx;
              return (
                <div key={m.m} className="flex-1 flex flex-col items-center justify-end h-full">
                  <div
                    className="w-full relative"
                    style={{
                      height: `${h}%`,
                      background: isBreakeven
                        ? "linear-gradient(180deg, rgba(229,51,65,0.95) 0%, rgba(229,51,65,0.35) 100%)"
                        : "linear-gradient(180deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.20) 100%)",
                    }}
                  >
                    {isBreakeven && (
                      <div className="absolute -top-[3vh] left-1/2 -translate-x-1/2 font-body uppercase tracking-[0.3em] text-[0.6vw] text-primary font-semibold whitespace-nowrap">
                        Breakeven
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="absolute inset-x-0 -bottom-[4vh] flex gap-[1vw]">
            {MONTHS.map((m) => (
              <div
                key={m.m}
                className="flex-1 text-center font-body uppercase tracking-[0.2em] text-[0.65vw] text-text/45 font-semibold tabular-nums"
              >
                {m.m}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-[10vh] grid grid-cols-3 gap-[2vw] max-w-[70vw]">
          <div className="border-t border-text/15 pt-[1.5vh]">
            <div className="font-display text-[2vw] leading-none tracking-tight text-text">M5</div>
            <div className="font-body uppercase tracking-[0.25em] text-[0.65vw] text-text/45 mt-[0.6vh] font-semibold">Breakeven</div>
          </div>
          <div className="border-t border-text/15 pt-[1.5vh]">
            <div className="font-display text-[2vw] leading-none tracking-tight text-text">18mo</div>
            <div className="font-body uppercase tracking-[0.25em] text-[0.65vw] text-text/45 mt-[0.6vh] font-semibold">Runway</div>
          </div>
          <div className="border-t border-text/15 pt-[1.5vh]">
            <div className="font-display text-[2vw] leading-none tracking-tight text-text">$3.2M</div>
            <div className="font-body uppercase tracking-[0.25em] text-[0.65vw] text-text/45 mt-[0.6vh] font-semibold">Revenue path</div>
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
