import EditorialSlide from "@/components/EditorialSlide";

export default function ProofEngine() {
  const base = import.meta.env.BASE_URL;
  return (
    <EditorialSlide
      slide={10}
      eyebrow="The Proof Engine"
      heroSrc={`${base}images/bg/12-proof.png`}
      heroObjectPosition="center"
      headline={
        <>
          <div>A concentrated</div>
          <div className="text-blue font-normal">proving ground.</div>
        </>
      }
      support={
        <p>
          Miami and Brickell hold a dense population of high-performance
          consumers — the fastest place to prove habit before we scale.
        </p>
      }
    />
  );
}
