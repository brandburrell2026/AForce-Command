import SlideChrome from "@/components/SlideChrome";

export default function TheSilence() {
  return (
    <SlideChrome slide={4} hideChrome>
      <div className="absolute inset-0 bg-black" />
      <div className="absolute inset-0 flex items-center justify-center px-[10vw]">
        <h2 className="font-display text-[5.8vw] leading-[1.05] tracking-tight text-text/95 text-center max-w-[80vw]">
          "Performance is not built
          <br />
          <span className="text-text/55">in noise."</span>
        </h2>
      </div>
      <div className="absolute bottom-[5vh] left-0 right-0 text-center">
        <div className="font-body uppercase tracking-[0.5em] text-[0.7vw] text-text/25 font-semibold">
          The Silence
        </div>
      </div>
    </SlideChrome>
  );
}
