export default function Closing() {
  const base = import.meta.env.BASE_URL;

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 55% 60% at 22% 50%, rgba(229,51,65,0.10) 0%, transparent 60%)" }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 50% 70% at 90% 50%, rgba(255,255,255,0.04) 0%, transparent 65%)" }}
      />

      <div className="absolute top-[5vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-primary font-semibold">27 — The Ask</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">27 / 27</div>
      </div>

      <div className="absolute top-[11vh] bottom-[8vh] left-[5vw] w-[38vw] z-10 flex items-center justify-center">
        <div className="relative w-full flex items-center justify-center">
          <div
            className="absolute -inset-[6%] rounded-3xl pointer-events-none"
            style={{ background: "radial-gradient(ellipse at 50% 55%, rgba(229,51,65,0.18) 0%, rgba(229,51,65,0.04) 45%, transparent 70%)", filter: "blur(40px)" }}
          />
          <div
            className="relative w-full rounded-2xl overflow-hidden ring-1 ring-text/10"
            style={{ aspectRatio: "870 / 810", boxShadow: "0 30px 50px rgba(0,0,0,0.55)" }}
          >
            <img
              src={`${base}brothers-tight.png`}
              alt="Brandon and Julius Burrell as children"
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>
        </div>
      </div>

      <div className="absolute top-[14vh] bottom-[10vh] left-[46vw] right-[5vw] z-10 flex flex-col">
        <h1 className="font-display text-[4.8vw] leading-[0.94] tracking-tighter text-balance">
          Performance is <span className="text-primary">non-negotiable.</span>
          <br />
          AForce makes sure you're <span className="text-text/55">always on.</span>
        </h1>

        <div className="mt-[3.4vh] font-display text-[1.7vw] leading-[1.2] tracking-tight text-text/90">
          Where there are <span className="text-primary">no off days.</span> <span className="text-primary">No missed moments.</span>
        </div>

        <div className="mt-[3.4vh] max-w-[52vw] relative rounded-2xl ring-1 ring-primary/35 bg-bg-elev/40 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.10] via-primary/[0.04] to-transparent pointer-events-none" />
          <div className="absolute inset-x-0 top-0 h-[3px] bg-primary" />
          <div className="relative px-[1.8vw] py-[1.8vh]">
            <div className="font-display text-[1.75vw] leading-[1.15] tracking-tight text-text">
              We're raising <span className="text-primary">$4M</span> to own the performance standard.
            </div>
            <ul className="mt-[1.4vh] grid grid-cols-2 gap-x-[1.6vw] gap-y-[0.8vh]">
              {[
                "Scale product to meet demand",
                "Launch AForce OS + subscription layer",
                "Expand retail + direct channels",
                "Build the performance brand",
              ].map((item) => (
                <li key={item} className="flex items-start gap-[0.7vw] font-body text-[0.95vw] text-text/85 leading-snug">
                  <span className="mt-[0.65vh] h-[0.55vh] w-[0.55vh] rounded-full bg-primary shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-auto">
          <div className="h-px w-[5vw] bg-primary mb-[2vh]" />
          <div className="font-display text-[2.2vw] leading-[1.15] tracking-tight text-text">
            The edge is <span className="text-primary">control.</span>
          </div>
        </div>
      </div>

      <div className="absolute bottom-[2vh] left-[6vw] right-[6vw] flex justify-between items-baseline z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-muted/50">
          Brandon &amp; Julius Burrell · Founders
        </div>
        <div className="font-body text-[0.7vw] text-muted/40">
          © 2026 AForce. All rights reserved.
        </div>
      </div>
    </div>
  );
}
