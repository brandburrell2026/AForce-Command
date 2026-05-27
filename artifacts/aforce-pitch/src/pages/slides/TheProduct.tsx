import SlideChrome from "@/components/SlideChrome";

export default function TheProduct() {
  return (
    <SlideChrome slide={6}>
      <div className="absolute inset-0 flex flex-col px-[9vw] py-[14vh]">
        <div className="font-body uppercase tracking-[0.32em] text-[0.75vw] text-text/45 font-medium mb-[3vh]">
          The Product
        </div>
        <h2 className="font-display font-light text-[4.2vw] leading-[1.05] tracking-tight max-w-[58vw]">
          Two formats. <span className="italic text-text/65">One ritual.</span>
        </h2>
        <p className="mt-[3vh] font-display font-light text-[1.5vw] text-text/55 leading-[1.35] max-w-[44vw]">
          Alkaline Force, pH 8.8. The formulation enters. The behavior retains.
        </p>

        <div className="mt-auto pt-[6vh] grid grid-cols-2 gap-x-[5vw] border-t border-divider">
          <ProductBlock
            tag="01 · Format"
            name="The RTD"
            line="Sustained daily readiness."
            meta="Ready to drink · 16oz · pH 8.8"
          />
          <ProductBlock
            tag="02 · Format"
            name="The Stick"
            line="Travel. Immediate correction."
            meta="Hydration stick · Single serve · pH 8.8"
            italic
          />
        </div>

        <div className="mt-[5vh] font-display text-[1.25vw] font-light italic text-text/70 max-w-[50vw]">
          The moat is not the formulation. The moat is the behavior.
        </div>
      </div>
    </SlideChrome>
  );
}

function ProductBlock({
  tag,
  name,
  line,
  meta,
  italic,
}: {
  tag: string;
  name: string;
  line: string;
  meta: string;
  italic?: boolean;
}) {
  return (
    <div className="pt-[3vh]">
      <div className="font-body uppercase tracking-[0.32em] text-[0.65vw] text-text/40 font-medium mb-[2vh]">
        {tag}
      </div>
      <div
        className={`font-display font-light text-[3.4vw] leading-[1] tracking-tight ${
          italic ? "italic text-text/85" : "text-text"
        }`}
      >
        {name}
      </div>
      <div className="mt-[2vh] font-display text-[1.25vw] text-text/65 leading-[1.4]">
        {line}
      </div>
      <div className="mt-[2.5vh] font-body uppercase tracking-[0.24em] text-[0.65vw] text-text/40">
        {meta}
      </div>
    </div>
  );
}
