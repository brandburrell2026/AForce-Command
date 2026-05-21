import SlideChrome from "@/components/SlideChrome";

export default function TheSilence() {
  return (
    <SlideChrome slide={4} hideChrome>
      <div className="absolute inset-0 bg-black" />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 50% 40% at 50% 50%, rgba(229,51,65,0.06) 0%, transparent 60%)",
        }}
      />

      <div className="absolute inset-0 flex flex-col items-center justify-center px-[10vw] text-center">
        <div className="font-body uppercase tracking-[0.6em] text-[0.8vw] text-text/30 font-semibold mb-[6vh]">
          The Silence
        </div>
        <h2 className="font-display text-[4.6vw] leading-[1.1] tracking-tight text-text/95 max-w-[68vw]">
          “Performance is not built
          <br />
          in <span className="text-primary">noise.</span>”
        </h2>
        <div className="mt-[10vh] flex items-center gap-[2vw] font-body uppercase tracking-[0.5em] text-[0.75vw] text-text/35 font-semibold">
          <span className="w-[4vw] h-px bg-text/20" />
          <span>Pause</span>
          <span className="w-[2vw] h-px bg-text/20" />
          <span>Silence</span>
          <span className="w-[4vw] h-px bg-text/20" />
        </div>
      </div>
    </SlideChrome>
  );
}
