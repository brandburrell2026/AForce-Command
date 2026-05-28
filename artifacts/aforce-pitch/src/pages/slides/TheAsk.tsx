import EditorialSlide from "@/components/EditorialSlide";

export default function TheAsk() {
  const base = import.meta.env.BASE_URL;
  return (
    <EditorialSlide
      slide={14}
      eyebrow="The Ask"
      heroSrc={`${base}images/bg/14-ask.png`}
      headline={
        <>
          <div className="text-red font-normal">$1.5M</div>
          <div>SAFE.</div>
          <div>Phase 1.</div>
        </>
      }
      footer={
        <>
          <p>A proof-of-concept raise. Not a scale raise.</p>
          <p>Product — two formats at concierge scale.</p>
          <p>OS build — behavioral engine, coaching layer, retention surfaces.</p>
          <p>Activation — Brickell event. Curated cohorts. Founder-installed ritual.</p>
        </>
      }
    />
  );
}
