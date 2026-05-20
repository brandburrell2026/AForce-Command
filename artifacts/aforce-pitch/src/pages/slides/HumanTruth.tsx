import SlideChrome from "@/components/SlideChrome";

export default function HumanTruth() {
  return (
    <SlideChrome slide={15}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 40%, rgba(84,120,213,0.08) 0%, transparent 70%)",
        }}
      />
      <div className="absolute inset-0 flex flex-col justify-center px-[10vw] text-center items-center">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[5vh]">
          The Human Truth
        </div>

        <h2 className="font-display text-[4.4vw] leading-[1.05] tracking-tight max-w-[70vw]">
          Performance is not built
          <br />
          in the moment.
        </h2>
        <h2 className="font-display text-[4.4vw] leading-[1.05] tracking-tight mt-[2vh] max-w-[70vw]">
          <span className="text-primary">It is built in the ritual before it.</span>
        </h2>

        <div className="mt-[7vh] flex flex-col gap-[0.4vh]">
          <div className="font-display text-[1.5vw] tracking-tight text-text/85">quiet</div>
          <div className="font-display text-[1.5vw] tracking-tight text-text/75">focused</div>
          <div className="font-display text-[1.5vw] tracking-tight text-text/65">controlled</div>
        </div>

        <div className="mt-[5vh] font-body text-[1.05vw] text-text/55 leading-[1.6] max-w-[45vw]">
          Everything has already been prepared. Now it is only about execution.
        </div>

        <div className="mt-[4vh] font-display text-[1.8vw] tracking-tight text-text">
          This is where <span className="text-primary">AForce</span> lives.
        </div>
      </div>
    </SlideChrome>
  );
}
