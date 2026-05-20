import SlideChrome from "@/components/SlideChrome";

export default function Founders() {
  return (
    <SlideChrome slide={14}>
      <div className="absolute inset-0 flex flex-col justify-center px-[6vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          The Founders
        </div>

        <div className="grid grid-cols-2 gap-[4vw] max-w-[80vw] mb-[8vh]">
          <div className="border-t border-text/20 pt-[2.5vh]">
            <div className="font-display text-[4vw] leading-[1] tracking-tight text-text">
              Brandon Burrell
            </div>
            <div className="mt-[2vh] space-y-[0.5vh]">
              <div className="font-body uppercase tracking-[0.3em] text-[0.85vw] text-primary font-semibold">NBA</div>
              <div className="font-body uppercase tracking-[0.3em] text-[0.85vw] text-text/75 font-semibold">Wall Street</div>
              <div className="font-body uppercase tracking-[0.3em] text-[0.85vw] text-text/75 font-semibold">Entrepreneurship</div>
            </div>
          </div>
          <div className="border-t border-text/20 pt-[2.5vh]">
            <div className="font-display text-[4vw] leading-[1] tracking-tight text-text">Julius</div>
            <div className="mt-[2vh] space-y-[0.5vh]">
              <div className="font-body uppercase tracking-[0.3em] text-[0.85vw] text-primary font-semibold">Wall Street</div>
              <div className="font-body uppercase tracking-[0.3em] text-[0.85vw] text-text/75 font-semibold">High-Performance Environments</div>
            </div>
          </div>
        </div>

        <div className="max-w-[55vw]">
          <div className="font-display text-[2vw] leading-[1.2] tracking-tight text-text/85">
            This is not a constructed story.
            <br />
            <span className="text-primary">It is lived experience.</span>
          </div>
          <div className="mt-[3vh] font-body text-[1.1vw] text-text/60 leading-[1.6]">
            They did not build AForce because they saw a market.
            <br />
            They built it because they understood the cost of <span className="text-text">not being ready</span>.
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
