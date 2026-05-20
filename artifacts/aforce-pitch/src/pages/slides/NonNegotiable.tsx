import SlideChrome from "@/components/SlideChrome";

const ARCHETYPES = [
  { role: "The founder", moment: "before the raise" },
  { role: "The athlete", moment: "before warm-up" },
  { role: "The performer", moment: "backstage" },
  { role: "The surgeon", moment: "before rounds" },
];

export default function NonNegotiable() {
  return (
    <SlideChrome slide={6}>
      <div className="absolute inset-0 flex flex-col justify-center px-[6vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-primary font-semibold mb-[3vh]">
          Performance is Non-Negotiable
        </div>

        <h2 className="font-display text-[5.2vw] leading-[0.95] tracking-tighter max-w-[70vw]">
          There is a certain kind of person
          <br />
          <span className="text-text/45">who does not get to be off.</span>
        </h2>

        <div className="mt-[6vh] max-w-[55vw]">
          <div className="font-body text-[1.1vw] text-text/65 leading-[1.6]">
            People operating under{" "}
            <span className="text-text">pressure</span>,{" "}
            <span className="text-text">responsibility</span>,{" "}
            <span className="text-text">expectations</span>, and constant performance demands.
          </div>
        </div>

        <div className="mt-[6vh] grid grid-cols-4 gap-[1.5vw] max-w-[80vw]">
          {ARCHETYPES.map((a) => (
            <div
              key={a.role}
              className="border-t border-text/15 pt-[2vh]"
            >
              <div className="font-display text-[1.6vw] leading-[1.1] tracking-tight text-text">
                {a.role}
              </div>
              <div className="font-body text-[0.9vw] text-text/50 mt-[0.6vh] uppercase tracking-[0.25em]">
                {a.moment}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-[7vh] font-display text-[2vw] tracking-tight text-text">
          Performance is <span className="text-primary">non-negotiable</span>.
        </div>
      </div>
    </SlideChrome>
  );
}
