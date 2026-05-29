import EditorialSlide from "@/components/EditorialSlide";

export default function ProofEngine() {
  return (
    <EditorialSlide
      slide={10}
      eyebrow="The Proof Engine"
      headline={
        <>
          <div>A concentrated</div>
          <div className="text-blue font-normal">proving ground.</div>
        </>
      }
      support={
        <>
          Miami and Brickell hold a dense population of high-performance
          consumers — the fastest place to prove habit before we scale.
        </>
      }
    />
  );
}
