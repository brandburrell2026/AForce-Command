import EditorialSlide from "@/components/EditorialSlide";

export default function TheFinal() {
  const base = import.meta.env.BASE_URL;
  return (
    <EditorialSlide
      slide={15}
      eyebrow="The Final Word"
      heroSrc={`${base}images/bg/15-final.png`}
      headline={
        <>
          <div>Performance is</div>
          <div className="text-red font-normal">non-negotiable.</div>
        </>
      }
      footer={
        <>
          <p>AForce makes sure you are always on.</p>
          <p>Pause. Hydrate. Lock in. Perform.</p>
        </>
      }
    />
  );
}
