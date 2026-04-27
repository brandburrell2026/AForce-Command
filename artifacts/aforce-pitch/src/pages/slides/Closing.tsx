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
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-primary font-semibold">24 — The Ask</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">24 / 24</div>
      </div>

      <div className="absolute top-[14vh] bottom-[12vh] left-[6vw] w-[28vw] z-10 flex items-center justify-center">
        <div className="relative w-full h-full flex items-center justify-center">
          <div
            className="absolute inset-[10%] rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle at 50% 55%, rgba(229,51,65,0.28) 0%, rgba(229,51,65,0.08) 35%, transparent 65%)", filter: "blur(40px)" }}
          />
          <img
            src={`${base}can-watermelon.png`}
            alt="AForce Watermelon Surge can"
            className="relative w-auto h-[78vh] object-contain"
            style={{ filter: "drop-shadow(0 30px 50px rgba(0,0,0,0.55))" }}
          />
        </div>
      </div>

      <div className="absolute top-[14vh] bottom-[10vh] left-[40vw] right-[6vw] z-10 flex flex-col">
        <h1 className="font-display text-[5.6vw] leading-[0.94] tracking-tighter text-balance">
          We don't get to be <span className="text-primary">off.</span>
          <br />
          So we built a system that <span className="text-text/55">doesn't let us be.</span>
        </h1>

        <div className="mt-[3.4vh] font-display text-[1.85vw] leading-[1.2] tracking-tight text-text/85">
          Two brothers. Built under <span className="text-primary">pressure.</span> Still <span className="text-primary">performing.</span>
        </div>

        <div className="mt-[5vh] grid grid-cols-2 gap-x-[2.4vw] max-w-[52vw]">
          <p className="font-body text-[1.05vw] leading-[1.55] text-text/70">
            <span className="text-text">AForce wasn't designed in theory.</span><br />
            It was built in real environments where performance mattered.
          </p>
          <p className="font-body text-[1.05vw] leading-[1.55] text-text/70">
            <span className="text-text">Before the product, we had to perform.</span><br />
            Now the product makes it repeatable.
          </p>
        </div>

        <div className="mt-auto">
          <div className="h-px w-[5vw] bg-primary mb-[2vh]" />
          <div className="font-display text-[2.4vw] leading-[1.15] tracking-tight text-text">
            If you can count on us —<br />
            you can count on <span className="text-primary">AForce.</span>
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
