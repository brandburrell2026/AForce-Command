import SlideChrome from "@/components/SlideChrome";

const ADVISORS = [
  { img: "mark-mendel.jpg", name: "Mark Mendel", domain: "Brand Building" },
  { img: "adam.jpg", name: "Adam Sobol", domain: "Scaling" },
  { img: "thomas.jpg", name: "Thomas Masterbouni", domain: "Retention Systems" },
  { img: "mark-satterfield.png", name: "Mark Satterfield", domain: "Chief Scientist" },
  { img: "kristel.jpg", name: "Kristel", domain: "Performance" },
  { img: "peter.jpg", name: "Peter", domain: "Behavior" },
];

export default function TeamAdvisors() {
  const base = import.meta.env.BASE_URL;
  return (
    <SlideChrome slide={24}>
      <div className="absolute inset-0 flex flex-col px-[6vw] pt-[12vh] pb-[10vh]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          Team
        </div>

        <h2 className="font-display text-[4.2vw] leading-[0.95] tracking-tighter mb-[5vh]">
          Built by people <span className="text-text/45">who understand.</span>
        </h2>

        <div className="grid grid-cols-6 gap-[1.2vw] flex-1 min-h-0">
          {ADVISORS.map((a) => (
            <div key={a.name} className="flex flex-col">
              <div className="relative w-full aspect-[3/4] overflow-hidden rounded-sm mb-[1.2vh]">
                <img
                  src={`${base}${a.img}`}
                  alt={a.name}
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ filter: "grayscale(1) contrast(1.05) brightness(0.92)" }}
                />
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(to top, rgba(8,9,14,0.55) 0%, transparent 50%)",
                  }}
                />
              </div>
              <div className="font-display text-[1.05vw] leading-[1.1] tracking-tight text-text">
                {a.name}
              </div>
              <div className="font-body uppercase tracking-[0.25em] text-[0.6vw] text-primary mt-[0.4vh] font-semibold">
                {a.domain}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-[4vh] font-display text-[1.5vw] leading-[1.2] tracking-tight max-w-[60vw]">
          <span className="text-text/55">Pressure. Scaling. Performance. Behavior.</span>{" "}
          <span className="text-text">Recurring consumer ecosystems.</span>
        </div>
      </div>
    </SlideChrome>
  );
}
