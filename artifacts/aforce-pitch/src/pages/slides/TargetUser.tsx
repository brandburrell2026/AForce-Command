import EditorialSlide from "@/components/EditorialSlide";

export default function TargetUser() {
  const base = import.meta.env.BASE_URL;
  return (
    <EditorialSlide
      slide={10}
      eyebrow="The Target User"
      heroSrc={`${base}images/bg/10-target.png`}
      headline={
        <>
          <div>People who</div>
          <div>do not get</div>
          <div className="text-red font-normal">to be off.</div>
        </>
      }
      footer={
        <>
          <p>Founders. Operators. Performers.</p>
          <p>Finance, entrepreneurship, pressure roles.</p>
          <p>Already invest in their body. Buy outcomes, not ingredients.</p>
          <p>Proof geography — Miami · Brickell.</p>
        </>
      }
    />
  );
}
