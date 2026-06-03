import SlideFrame from "@/components/SlideFrame";

// Three visuals max — the loudest names in the category, overlapping as noise.
const NOISE = [
  { t: "MONSTER", top: "20%", left: "60%", size: "6vw", rot: -7, o: 0.13 },
  { t: "CELSIUS", top: "44%", left: "70%", size: "5vw", rot: 5, o: 0.16 },
  { t: "PRIME", top: "64%", left: "58%", size: "7vw", rot: -3, o: 0.11 },
];

export default function CategoryNoise() {
  return (
    <SlideFrame slide={7}>
      <div className="absolute inset-0 overflow-hidden">
        {/* the chaos — three competitor wordmarks, overlapping, static */}
        {NOISE.map((n) => (
          <div
            key={n.t}
            aria-hidden
            className="absolute font-display font-extrabold tracking-tight text-text whitespace-nowrap select-none"
            style={{
              top: n.top,
              left: n.left,
              fontSize: n.size,
              opacity: n.o,
              transform: `rotate(${n.rot}deg)`,
            }}
          >
            {n.t}
          </div>
        ))}

        {/* the message — calm */}
        <div className="absolute inset-y-0 left-0 w-[52%] flex flex-col justify-center px-[5vw]">
          <div className="mb-[5vh]">
            <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-red font-semibold border-b-2 border-red pb-[0.6vh]">
              The Problem
            </span>
          </div>

          <h1 className="font-display font-light tracking-[-0.025em] text-[5.6vw] leading-[1.02] text-text">
            <div>The category</div>
            <div>
              is <span className="text-red font-normal">noise.</span>
            </div>
          </h1>

          <p className="mt-[4vh] max-w-[34vw] font-body text-[1.1vw] leading-[1.55] text-text/70">
            Every brand competes for attention. Almost none compete for
            composure.
          </p>
        </div>
      </div>
    </SlideFrame>
  );
}
