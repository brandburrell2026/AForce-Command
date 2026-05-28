import EditorialSlide from "@/components/EditorialSlide";

export default function TheNoise() {
  const base = import.meta.env.BASE_URL;
  return (
    <EditorialSlide
      slide={2}
      eyebrow="The Problem"
      heroSrc={`${base}images/bg/02-noise.png`}
      headline={
        <>
          <div>Performance</div>
          <div>has become</div>
          <div className="text-red font-normal">noise.</div>
        </>
      }
      footer={
        <>
          <p>More products. More claims. More routines.</p>
          <p>More optimization. More content. More noise.</p>
          <p>The signal is gone.</p>
          <p>The category has confused activity with readiness.</p>
        </>
      }
    />
  );
}
