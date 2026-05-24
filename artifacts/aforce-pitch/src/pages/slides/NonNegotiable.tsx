import SlideChrome from "@/components/SlideChrome";

import nnBg from "@assets/non_negotiable_B2.png";

const PERSONAS = [
  { who: "The founder", when: "before the raise" },
  { who: "The athlete", when: "before warm-up" },
  { who: "The performer", when: "backstage" },
  { who: "The surgeon", when: "before rounds" },
];

const PRESSURE = ["Pressure", "Responsibility", "Expectations", "Constant performance demands"];

export default function NonNegotiable() {
  return (
    <SlideChrome slide={6}>
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${nnBg})`,
          filter: "grayscale(1) contrast(1.12) brightness(1.05)",
          opacity: 0.9,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.58) 40%, rgba(0,0,0,0.3) 70%, rgba(0,0,0,0.15) 100%)",
        }}
      />
      <div className="absolute inset-0 flex flex-col justify-center px-[8vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          Performance Is Non-Negotiable
        </div>

        <h2 className="font-display text-[4.4vw] leading-[1.05] tracking-tight max-w-[70vw] text-text/90">
          There is a certain kind of person who
          <br />
          <span className="text-primary">does not get to be off.</span>
        </h2>

        <div className="mt-[6vh] grid grid-cols-12 gap-[3vw]">
          <div className="col-span-7 flex flex-col gap-[1.6vh]">
            {PERSONAS.map((p) => (
              <div key={p.who} className="flex items-baseline gap-[1vw]">
                <span className="font-display text-[2.4vw] leading-none tracking-tight text-text">
                  {p.who}
                </span>
                <span className="font-body text-[1.1vw] text-text/45 italic">{p.when}.</span>
              </div>
            ))}
          </div>

          <div className="col-span-5 border-l border-text/10 pl-[2vw]">
            <div className="font-body uppercase tracking-[0.32em] text-[0.75vw] text-text/40 font-semibold mb-[1.5vh]">
              Operating under
            </div>
            <div className="flex flex-wrap gap-[0.6vw]">
              {PRESSURE.map((p) => (
                <span
                  key={p}
                  className="px-[1vw] py-[0.6vh] border border-text/15 rounded-full font-body text-[0.9vw] text-text/75"
                >
                  {p}
                </span>
              ))}
            </div>
            <div className="mt-[4vh] font-display text-[1.8vw] leading-[1.15] tracking-tight text-primary">
              Performance is non-negotiable.
            </div>
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
