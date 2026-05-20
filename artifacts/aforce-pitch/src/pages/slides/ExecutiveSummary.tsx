import SlideChrome from "@/components/SlideChrome";

export default function ExecutiveSummary() {
  const base = import.meta.env.BASE_URL;
  return (
    <SlideChrome slide={1}>
      <div className="absolute inset-y-0 right-0 w-[48vw] flex items-center justify-center">
        <div
          className="absolute w-[36vw] h-[36vw] rounded-full opacity-50 blur-[6vw]"
          style={{
            background:
              "radial-gradient(circle, rgba(84,120,213,0.55) 0%, rgba(84,120,213,0.15) 45%, transparent 72%)",
          }}
        />
        <div
          className="absolute bottom-[10vh] w-[24vw] h-[3vh] rounded-[50%] blur-[2vw] opacity-65"
          style={{
            background:
              "radial-gradient(ellipse, rgba(0,0,0,0.85) 0%, transparent 70%)",
          }}
        />
        <img
          src={`${base}can-berry.png`}
          alt=""
          className="relative h-[78vh] object-contain"
          style={{
            filter:
              "drop-shadow(0 30px 50px rgba(0,0,0,0.55)) drop-shadow(0 0 60px rgba(84,120,213,0.30))",
          }}
        />
      </div>

      <div
        className="absolute inset-y-0 left-0 w-[55vw] pointer-events-none"
        style={{
          background:
            "linear-gradient(to right, var(--slide-bg) 62%, transparent 100%)",
        }}
      />

      <div className="absolute inset-0 flex flex-col justify-between px-[6vw] py-[14vh] pointer-events-none">
        <div>
          <div className="font-display text-[2.6vw] leading-none tracking-tight text-primary mb-[2vh]">
            AForce
          </div>
          <h1 className="font-display text-[5.6vw] leading-[0.92] tracking-tighter max-w-[50vw]">
            A behavioral
            <br />
            performance
            <br />
            ecosystem.
          </h1>
          <div className="font-display text-[2vw] leading-[1.15] tracking-tight text-text/45 mt-[2vh] max-w-[50vw]">
            Not another hydration brand.
          </div>
        </div>

        <div className="max-w-[44vw]">
          <div className="font-body text-[1.05vw] leading-[1.6] text-text/70">
            The category is loud — stimulation, hype, spikes. AForce operates in quiet focus, control, preparation before performance.
          </div>
          <div className="mt-[2.5vh] font-display text-[1.7vw] leading-[1.15] tracking-tight">
            <span className="text-primary">Pause.</span>{" "}
            <span className="text-text">Hydrate.</span>{" "}
            <span className="text-accent">Lock in.</span>{" "}
            <span className="text-text/70">Perform.</span>
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
