import SlideChrome from "@/components/SlideChrome";

export default function TheSilence() {
  const base = import.meta.env.BASE_URL;
  return (
    <SlideChrome slide={3}>
      <div className="absolute inset-0">
        <img
          src={`${base}images/doc-silence.png`}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: "saturate(0.45) contrast(1.05) sepia(0.22) brightness(0.92)" }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, rgba(244,241,234,0.88) 0%, rgba(244,241,234,0.72) 35%, rgba(244,241,234,0.05) 70%)",
          }}
        />

        <div className="absolute inset-0 flex items-center px-[9vw]">
          <div className="max-w-[42vw]">
            <div className="font-body uppercase tracking-[0.32em] text-[0.75vw] text-text/55 font-medium mb-[4vh]">
              The Truth
            </div>
            <h2 className="font-display font-light text-[5.4vw] leading-[1.02] tracking-tight">
              Performance is not built<br />
              in noise.
            </h2>
            <p className="mt-[5vh] pt-[3vh] border-t border-text/25 font-display text-[1.7vw] font-light leading-[1.35] text-text/85 max-w-[34vw]">
              It is built in the <span className="italic">silence</span> before the moment.
            </p>
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
