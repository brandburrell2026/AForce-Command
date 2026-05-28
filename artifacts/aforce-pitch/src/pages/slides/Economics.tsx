import EditorialSlide from "@/components/EditorialSlide";

export default function Economics() {
  const base = import.meta.env.BASE_URL;
  return (
    <EditorialSlide
      slide={13}
      eyebrow="Unit Economics"
      heroSrc={`${base}images/bg/13-economics.png`}
      headline={
        <>
          <div>Performance</div>
          <div>creates retention.</div>
          <div className="text-blue font-normal">Retention drives</div>
          <div className="text-blue font-normal">revenue.</div>
        </>
      }
      footer={
        <>
          <p>CAC &lt; $45 — within target threshold.</p>
          <p>Subscription conversion 20%+ from core to paid.</p>
          <p>Repeat purchase 28–32% across early cohorts.</p>
          <p>Projected LTV / CAC 3.4× at year-one steady state.</p>
        </>
      }
    />
  );
}
