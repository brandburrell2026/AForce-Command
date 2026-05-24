import SlideChrome from "@/components/SlideChrome";

import shiftBg from "@assets/category_shift_B.png";

const OPPORTUNITY = [
  "Recurring engagement",
  "Accountability",
  "Retention",
  "Optimization",
  "Ecosystem adoption",
];

export default function CategoryShift() {
  return (
    <SlideChrome slide={5}>
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url(${shiftBg})`,
          backgroundPosition: "right center",
          filter: "grayscale(1) contrast(1.15) brightness(1.15)",
          opacity: 1,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.7) 35%, rgba(0,0,0,0.25) 65%, rgba(0,0,0,0) 100%)",
        }}
      />
      <div className="absolute inset-0 flex flex-col justify-center px-[8vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          The Category Shift
        </div>

        <h2 className="font-display text-[5.2vw] leading-[0.95] tracking-tighter max-w-[80vw]">
          AForce is not a
          <br />
          <span className="text-text/40">hydration brand.</span>
        </h2>

        <div className="mt-[3vh] font-display text-[3.2vw] leading-[1.1] tracking-tight text-primary max-w-[70vw]">
          It is a performance operating system.
        </div>

        <div className="mt-[6vh] grid grid-cols-12 gap-[3vw] items-start">
          <div className="col-span-6">
            <div className="font-body text-[1.15vw] text-text/80 leading-[1.7] max-w-[34vw]">
              Hydration is the entry point.
              <br />
              The larger opportunity is the system around it.
            </div>
          </div>
          <div className="col-span-6 border-l border-text/10 pl-[2vw]">
            <div className="font-body uppercase tracking-[0.32em] text-[0.75vw] text-text/55 font-semibold mb-[1.5vh]">
              The opportunity
            </div>
            <div className="flex flex-wrap gap-[0.6vw]">
              {OPPORTUNITY.map((o) => (
                <span
                  key={o}
                  className="px-[1vw] py-[0.6vh] border border-text/25 rounded-full font-body text-[0.95vw] text-text/90"
                >
                  {o}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-[7vh] font-display text-[1.6vw] leading-[1.3] tracking-tight text-text/85 max-w-[55vw]">
          Others react after performance drops.
          <br />
          <span className="text-text">AForce prepares people before performance begins.</span>
        </div>
      </div>
    </SlideChrome>
  );
}
