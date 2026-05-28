import EditorialSlide from "@/components/EditorialSlide";

export default function CategoryShift() {
  const base = import.meta.env.BASE_URL;
  return (
    <EditorialSlide
      slide={4}
      eyebrow="The Category Shift"
      heroSrc={`${base}images/bg/04-shift.png`}
      headline={
        <>
          <div>Not a hydration</div>
          <div>brand.</div>
          <div className="text-blue font-normal">A behavioral</div>
          <div className="text-blue font-normal">ecosystem.</div>
        </>
      }
      footer={
        <>
          <p>The category sells moments. A drink. A spike. A scroll.</p>
          <p>AForce builds readiness.</p>
          <p>A ritual. A loop. A system.</p>
        </>
      }
    />
  );
}
