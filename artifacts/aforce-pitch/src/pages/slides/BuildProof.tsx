import SlideChrome from "@/components/SlideChrome";

type Metric = {
  label: string;
  value: string;
  unit?: string;
  caption: string;
  spark: number[];
  accent?: boolean;
};

const METRICS: Metric[] = [
  {
    label: "CAC Target",
    value: "< $24",
    caption: "Founder-led, no paid scale",
    spark: [42, 38, 33, 30, 27, 24, 22],
  },
  {
    label: "Repeat Purchase",
    value: "28–32",
    unit: "%",
    caption: "Within 30 days",
    spark: [12, 16, 19, 22, 25, 28, 30],
  },
  {
    label: "Subscription Conversion",
    value: "20",
    unit: "%+",
    caption: "OS Core → Professionals",
    spark: [4, 7, 11, 14, 17, 19, 21],
  },
  {
    label: "Ritual Adoption",
    value: "65",
    unit: "%",
    caption: "Day 7 protocol completion",
    spark: [22, 31, 39, 48, 54, 60, 65],
  },
  {
    label: "OS Engagement",
    value: "0.42",
    caption: "DAU / MAU",
    spark: [0.18, 0.22, 0.27, 0.31, 0.35, 0.39, 0.42],
  },
  {
    label: "Ecosystem Participation",
    value: "24",
    unit: "%",
    caption: "Circles · Territory · Coach",
    spark: [3, 6, 9, 13, 17, 21, 24],
  },
];

function Spark({ data, accent = false }: { data: number[]; accent?: boolean }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 100 - ((v - min) / span) * 100;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="w-full h-full"
      aria-hidden
    >
      <polyline
        points={pts}
        fill="none"
        stroke={accent ? "var(--slide-primary)" : "currentColor"}
        strokeWidth={accent ? 1.8 : 1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function HeroArc({ pct }: { pct: number }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);
  return (
    <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90" aria-hidden>
      <circle
        cx={60}
        cy={60}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={1}
        className="text-text/15"
      />
      <circle
        cx={60}
        cy={60}
        r={r}
        fill="none"
        stroke="var(--slide-primary)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        style={{ filter: "drop-shadow(0 0 6px rgba(229,51,65,0.55))" }}
      />
    </svg>
  );
}

export default function BuildProof() {
  return (
    <SlideChrome slide={21}>
      <div className="absolute inset-0 flex flex-col px-[8vw] pt-[12vh] pb-[10vh]">
        {/* Header */}
        <div className="flex items-start justify-between gap-[2vw]">
          <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold">
            Proof Metrics · Phase 1
          </div>
          <div className="font-body text-[0.85vw] leading-[1.5] text-text/65 text-right max-w-[28vw]">
            <span className="text-text/90 font-semibold">Disciplined execution.</span>{" "}
            Measured proof. Controlled scale.
          </div>
        </div>

        {/* Headline */}
        <h2 className="font-display text-[4.4vw] leading-[0.95] tracking-tighter max-w-[80vw] mt-[2vh]">
          Not awareness.
          <br />
          <span className="text-primary">Validation.</span>
        </h2>

        {/* Dashboard */}
        <div className="mt-[5vh] flex-1 grid grid-cols-12 gap-[2.4vw] items-stretch">
          {/* Hero metric — D28 Retention */}
          <div className="col-span-4 flex flex-col justify-between border-l border-text/15 pl-[1.6vw]">
            <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-primary/80 font-semibold">
              North Star · Day 28 Retention
            </div>
            <div className="relative mt-[1vh]">
              <div className="absolute inset-0 -z-10 flex items-center justify-center">
                <div className="size-[18vw] opacity-90">
                  <HeroArc pct={0.38} />
                </div>
              </div>
              <div className="flex items-baseline gap-[0.4vw] pl-[1vw] pt-[3vh]">
                <span className="font-display text-[7.5vw] leading-[0.85] tracking-tighter text-text">
                  38
                </span>
                <span className="font-display text-[2.2vw] leading-[1] tracking-tight text-primary">
                  %
                </span>
              </div>
            </div>
            <div className="font-body text-[0.8vw] leading-[1.5] text-text/55 mt-[1.5vh]">
              The behavior holds, or it does not.
              <br />
              <span className="text-text/85">This is the only number that matters.</span>
            </div>
          </div>

          {/* 6-metric grid */}
          <div className="col-span-8 grid grid-cols-3 grid-rows-2 gap-[1.6vw]">
            {METRICS.map((m) => (
              <div
                key={m.label}
                className="border-l border-text/15 pl-[1.2vw] flex flex-col justify-between"
              >
                <div className="font-body uppercase tracking-[0.28em] text-[0.62vw] text-text/45 font-semibold">
                  {m.label}
                </div>
                <div className="flex items-baseline gap-[0.25vw] mt-[1vh]">
                  <span className="font-display text-[3.2vw] leading-[0.9] tracking-tighter text-text tabular-nums">
                    {m.value}
                  </span>
                  {m.unit && (
                    <span className="font-display text-[1.2vw] leading-[1] tracking-tight text-text/55">
                      {m.unit}
                    </span>
                  )}
                </div>
                <div className="text-text/30 h-[2.4vh] mt-[0.8vh]">
                  <Spark data={m.spark} accent={m.accent} />
                </div>
                <div className="font-body text-[0.65vw] tracking-[0.04em] text-text/45 mt-[0.6vh]">
                  {m.caption}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-[3vh] flex items-baseline justify-between gap-[3vw]">
          <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/35 font-semibold">
            Phase 1 · Brickell → NYC · 50–100 selected users
          </div>
          <div className="font-display text-[1.4vw] leading-[1.15] tracking-tight text-text/85">
            Do they come back? <span className="text-primary">That is the proof.</span>
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
