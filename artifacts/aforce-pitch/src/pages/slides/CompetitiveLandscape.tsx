import SlideChrome from "@/components/SlideChrome";
import PatentBadge from "@/components/PatentBadge";
import Disclosure from "@/components/Disclosure";

const THEM = [
  { label: "Spikes", rot: -7, x: 6, y: 4, size: 3.4, op: 0.55 },
  { label: "Stimulation", rot: 5, x: 32, y: 12, size: 2.6, op: 0.4 },
  { label: "Hype", rot: -3, x: 14, y: 24, size: 4.2, op: 0.7 },
  { label: "Chaos", rot: 11, x: 44, y: 30, size: 3.0, op: 0.35 },
  { label: "Loud branding", rot: -9, x: 4, y: 46, size: 2.4, op: 0.45 },
  { label: "Temporary energy", rot: 4, x: 24, y: 62, size: 2.8, op: 0.55 },
  { label: "Noise", rot: -14, x: 50, y: 74, size: 3.6, op: 0.3 },
];

const US = [
  "Ritual",
  "Retention",
  "Accountability",
  "Sustained readiness",
  "Behavioral reinforcement",
  "Ecosystem engagement",
];

export default function CompetitiveLandscape() {
  return (
    <SlideChrome slide={20}>
      <div className="absolute inset-0 flex flex-col px-[8vw] pt-[10vh] pb-[18vh]">
        {/* Header row */}
        <div className="flex items-start justify-between gap-[2vw]">
          <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold">
            Competitive Positioning
          </div>
          <div className="flex flex-col items-end gap-[1.4vh] max-w-[28vw]">
            <div className="font-body text-[0.85vw] leading-[1.5] text-text/65 text-right">
              <span className="text-text/90 font-semibold">CPG is copied. Systems compound.</span>{" "}
              No competitor has fused product, data, and protocol into one operating system.
            </div>
            <PatentBadge />
          </div>
        </div>

        {/* Headline */}
        <h2 className="font-display text-[4.4vw] leading-[0.95] tracking-tighter max-w-[80vw] mt-[2vh]">
          Calm vs <span className="text-text/40">chaos.</span>
          <br />
          Discipline vs <span className="text-primary">stimulation.</span>
        </h2>

        {/* Split visual */}
        <div className="mt-[5vh] flex-1 grid grid-cols-2 gap-0 relative">
          {/* Vertical divider with red accent */}
          <div
            className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2 w-px bg-text/15"
            aria-hidden
          />
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-px h-[12vh] bg-primary"
            aria-hidden
          />
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-[0.55vw] rounded-full bg-primary"
            aria-hidden
            style={{ boxShadow: "0 0 24px rgba(226,92,92,0.6)" }}
          />

          {/* LEFT — chaos */}
          <div className="relative pr-[3vw]">
            <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/40 font-semibold mb-[2vh]">
              Traditional Category
            </div>
            <div className="relative h-[34vh]">
              {THEM.map((w) => (
                <span
                  key={w.label}
                  className="absolute font-display tracking-tight text-text/70 select-none whitespace-nowrap"
                  style={{
                    left: `${w.x}%`,
                    top: `${w.y}%`,
                    fontSize: `${w.size}vw`,
                    transform: `rotate(${w.rot}deg)`,
                    opacity: w.op,
                    lineHeight: 1,
                  }}
                >
                  {w.label}
                </span>
              ))}
            </div>
          </div>

          {/* RIGHT — discipline */}
          <div className="relative pl-[3vw]">
            <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-primary/80 font-semibold mb-[2vh]">
              AForce
            </div>
            <div className="flex flex-col gap-[1.6vh]">
              {US.map((u) => (
                <div
                  key={u}
                  className="font-display text-[1.7vw] leading-[1.1] tracking-tight text-text/95"
                >
                  {u}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer summary */}
        <div className="mt-[3vh] flex items-baseline justify-between gap-[3vw]">
          <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/35 font-semibold">
            Control over noise
          </div>
          <div className="font-display text-[1.6vw] leading-[1.15] tracking-tight text-text/85">
            The category sells <span className="text-text/45">moments.</span>{" "}
            AForce builds <span className="text-primary">the loop.</span>
          </div>
        </div>
      </div>

      <Disclosure
        label="Trademarks"
        body="Third-party names and marks referenced in this deck are the property of their respective owners. References are for comparative and illustrative purposes only and do not imply endorsement or affiliation."
      />
    </SlideChrome>
  );
}
