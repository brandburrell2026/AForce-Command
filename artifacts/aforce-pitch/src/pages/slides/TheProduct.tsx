import EditorialSlide from "@/components/EditorialSlide";

export default function TheProduct() {
  const base = import.meta.env.BASE_URL;
  return (
    <EditorialSlide
      slide={6}
      eyebrow="The Product"
      heroSrc={`${base}images/bg/06-product.png`}
      headline={
        <>
          <div>Two formats.</div>
          <div className="text-blue font-normal">One ritual.</div>
        </>
      }
      footer={
        <>
          <p>Alkaline Force, pH 8.8.</p>
          <p>The RTD — sustained daily readiness.</p>
          <p>The Stick — travel, immediate correction.</p>
          <p>The moat is not the formulation. The moat is the behavior.</p>
        </>
      }
    />
  );
}
