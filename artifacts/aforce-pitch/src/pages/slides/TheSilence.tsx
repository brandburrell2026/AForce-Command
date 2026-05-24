import SlideChrome from "@/components/SlideChrome";
import silenceImg from "@assets/generated_images/silence_athlete_tunnel.png";

export default function TheSilence() {
  return (
    <SlideChrome slide={4} hideChrome>
      {/* Image bed */}
      <div className="absolute inset-0 bg-black" />
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url(${silenceImg})`,
          filter: "grayscale(1) contrast(1.02)",
          opacity: 0.92,
        }}
      />

      {/* Left-darkening gradient so text holds */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.82) 28%, rgba(0,0,0,0.55) 52%, rgba(0,0,0,0.15) 78%, rgba(0,0,0,0) 100%)",
        }}
      />
      {/* Top + bottom vignette to settle the frame */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 18%, rgba(0,0,0,0) 80%, rgba(0,0,0,0.6) 100%)",
        }}
      />
      {/* Single restrained red ambient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 40% 32% at 22% 58%, rgba(229,51,65,0.07) 0%, transparent 70%)",
        }}
      />

      {/* Text — left-aligned, sitting on the dark side */}
      <div className="absolute inset-0 flex flex-col justify-center pl-[8vw] pr-[42vw] pt-[6vh]">
        <div className="font-body uppercase tracking-[0.6em] text-[0.8vw] text-text/40 font-semibold mb-[5vh]">
          The Silence
        </div>
        <h2 className="font-display text-[4.4vw] leading-[1.05] tracking-tight text-text/95 max-w-[44vw]">
          Performance is not built
          <br />
          in <span className="text-primary">noise.</span>
        </h2>
        <div className="mt-[7vh] flex items-center gap-[1.6vw] font-body uppercase tracking-[0.5em] text-[0.75vw] text-text/40 font-semibold">
          <span className="w-[3vw] h-px bg-text/25" />
          <span>Pause</span>
          <span className="w-[1.6vw] h-px bg-text/25" />
          <span>Silence</span>
          <span className="w-[3vw] h-px bg-text/25" />
        </div>
      </div>

      {/* Footer eyebrow */}
      <div className="absolute bottom-[5vh] left-[6vw] right-[6vw] flex justify-between items-center pointer-events-none">
        <div className="font-body uppercase tracking-[0.4em] text-[0.7vw] text-text/30 font-semibold">
          AForce · Section 1 · Positioning
        </div>
        <div className="font-body uppercase tracking-[0.4em] text-[0.7vw] text-text/30 font-semibold tabular-nums">
          04 / 31
        </div>
      </div>
    </SlideChrome>
  );
}
