import SlideChrome from "@/components/SlideChrome";

const MOAT = [
  { tag: "Closed-Loop Data", detail: "Every drink, scan, and recovery feeds the system." },
  { tag: "Personalized Reinforcement", detail: "The OS adapts to behavior — not the other way around." },
  { tag: "Ecosystem Lock-In", detail: "Product, ritual, OS, subscription, identity — interlocked." },
  { tag: "Compounding Behavior", detail: "The longer a user stays, the harder they are to leave." },
];

export default function SystemIsMoat() {
  return (
    <SlideChrome slide={16}>
      <div className="absolute inset-0 flex flex-col justify-center px-[8vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          The System Is the Moat
        </div>

        <h2 className="font-display text-[5.2vw] leading-[0.92] tracking-tighter max-w-[80vw]">
          <span className="text-text/45">The category has drinks.</span>
          <br />
          AForce has a <span className="text-primary">loop.</span>
        </h2>

        <div className="mt-[7vh] grid grid-cols-2 gap-x-[3vw] gap-y-[2.5vh] max-w-[78vw]">
          {MOAT.map((m) => (
            <div key={m.tag} className="border-t border-text/15 pt-[1.5vh]">
              <div className="font-display text-[1.6vw] leading-[1.1] tracking-tight text-text">
                {m.tag}
              </div>
              <div className="font-body text-[0.9vw] text-text/55 mt-[0.6vh] leading-[1.5]">
                {m.detail}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-[6vh] font-display text-[1.4vw] leading-[1.2] tracking-tight max-w-[60vw]">
          <span className="text-text/55">Anyone can copy a formulation.</span>{" "}
          <span className="text-text">No one can copy years of behavioral data.</span>
        </div>
      </div>
    </SlideChrome>
  );
}
