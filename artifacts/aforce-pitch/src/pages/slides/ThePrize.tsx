import SlideFrame from "@/components/SlideFrame";

const BARS = [
  { year: "2024", h: 34, label: "$1.4B" },
  { year: "2026", h: 52, label: "$2.1B" },
  { year: "2028", h: 74, label: "$3.0B" },
  { year: "2030", h: 100, label: "$4.2B" },
];

export default function ThePrize() {
  return (
    <SlideFrame slide={4}>
      <div className="absolute inset-0 flex">
        {/* LEFT — the number */}
        <div className="w-[52%] flex flex-col justify-center px-[5vw]">
          <div className="mb-[4vh]">
            <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-blue font-semibold border-b-2 border-blue pb-[0.6vh]">
              The Prize
            </span>
          </div>

          <div className="font-display font-light tracking-[-0.04em] text-[8vw] leading-[0.9] text-text">
            $4.2<span className="text-red font-normal">B</span>
          </div>
          <div className="mt-[2vh] font-display uppercase tracking-[0.22em] text-[0.8vw] text-text/55 font-medium">
            U.S. performance hydration by 2030 · illustrative
          </div>

          <p className="mt-[4vh] max-w-[34vw] font-display text-[1.15vw] leading-[1.5] text-text/70">
            The market is evolving beyond energy into readiness, recovery, and
            daily ritual — and nobody owns the behavior.
          </p>
        </div>

        {/* RIGHT — growth chart */}
        <div className="w-[48%] flex items-center pr-[7vw] pl-[2vw]">
          <div className="w-full">
            <div className="flex items-end justify-between gap-[2vw] h-[42vh]">
              {BARS.map((b, i) => (
                <div key={b.year} className="flex-1 flex flex-col items-center justify-end h-full">
                  <div className="font-display text-[1.1vw] font-medium text-text mb-[1.2vh]">
                    {b.label}
                  </div>
                  <div
                    className={`w-full rounded-t-[0.3vw] ${i === BARS.length - 1 ? "bg-red" : "bg-text/20"}`}
                    style={{ height: `${b.h}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between gap-[2vw] mt-[1.4vh] border-t border-text/20 pt-[1.2vh]">
              {BARS.map((b) => (
                <div key={b.year} className="flex-1 text-center font-display uppercase tracking-[0.18em] text-[0.7vw] text-text/50">
                  {b.year}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SlideFrame>
  );
}
