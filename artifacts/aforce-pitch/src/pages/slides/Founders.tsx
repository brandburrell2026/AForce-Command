import SlideChrome from "@/components/SlideChrome";

export default function FounderProof() {
  const base = import.meta.env.BASE_URL;
  return (
    <SlideChrome slide={3}>
      <div className="absolute inset-0 flex flex-col px-[6vw] pt-[12vh] pb-[10vh]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          Founder Proof
        </div>

        <h2 className="font-display text-[4.2vw] leading-[0.95] tracking-tighter mb-[1vh] max-w-[60vw]">
          Built from lived pressure.
        </h2>
        <div className="font-display text-[1.5vw] leading-[1.2] tracking-tight text-text/55 mb-[4vh] max-w-[55vw]">
          Where <span className="text-primary">failure has consequences.</span>
        </div>

        <div className="grid grid-cols-2 gap-[3vw] flex-1 min-h-0">
          <div className="flex gap-[2vw] items-end">
            <div className="relative w-[17vw] h-[23vw] flex-shrink-0 overflow-hidden rounded-sm">
              <img
                src={`${base}brandon.jpg`}
                alt="Brandon Burrell"
                className="absolute inset-0 w-full h-full object-cover"
                style={{ filter: "grayscale(1) contrast(1.05) brightness(0.92)" }}
              />
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "linear-gradient(to top, rgba(8,9,14,0.6) 0%, transparent 50%)",
                }}
              />
            </div>
            <div className="flex-1 pb-[1vh]">
              <div className="font-display text-[2.4vw] leading-[1] tracking-tight text-text">
                Brandon
                <br />
                Burrell
              </div>
              <div className="mt-[2vh] space-y-[0.4vh]">
                <div className="font-body uppercase tracking-[0.3em] text-[0.75vw] text-primary font-semibold">NBA</div>
                <div className="font-body uppercase tracking-[0.3em] text-[0.75vw] text-text/75 font-semibold">Wall Street</div>
                <div className="font-body uppercase tracking-[0.3em] text-[0.75vw] text-text/75 font-semibold">Entrepreneurship</div>
              </div>
            </div>
          </div>

          <div className="flex gap-[2vw] items-end">
            <div className="relative w-[17vw] h-[23vw] flex-shrink-0 overflow-hidden rounded-sm">
              <img
                src={`${base}julius.jpg`}
                alt="Julius Burrell"
                className="absolute inset-0 w-full h-full object-cover"
                style={{ filter: "grayscale(1) contrast(1.05) brightness(0.92)" }}
              />
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "linear-gradient(to top, rgba(8,9,14,0.6) 0%, transparent 50%)",
                }}
              />
            </div>
            <div className="flex-1 pb-[1vh]">
              <div className="font-display text-[2.4vw] leading-[1] tracking-tight text-text">
                Julius
                <br />
                Burrell
              </div>
              <div className="mt-[2vh] space-y-[0.4vh]">
                <div className="font-body uppercase tracking-[0.3em] text-[0.75vw] text-primary font-semibold">Wall Street</div>
                <div className="font-body uppercase tracking-[0.3em] text-[0.75vw] text-text/75 font-semibold">High-Performance Environments</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-[3vh] font-display text-[1.4vw] leading-[1.25] tracking-tight max-w-[60vw] text-text/70">
          They did not build AForce because they saw a market.
          <br />
          <span className="text-text">They built it because they understood the cost of not being ready.</span>
        </div>
      </div>
    </SlideChrome>
  );
}
