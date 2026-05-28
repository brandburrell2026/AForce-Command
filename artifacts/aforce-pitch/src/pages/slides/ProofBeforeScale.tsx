import EditorialSlide from "@/components/EditorialSlide";

export default function ProofBeforeScale() {
  const base = import.meta.env.BASE_URL;
  return (
    <EditorialSlide
      slide={12}
      eyebrow="Proof Before Scale"
      heroSrc={`${base}images/bg/12-proof.png`}
      headline={
        <>
          <div>Not about</div>
          <div>awareness.</div>
          <div className="text-blue font-normal">About validation.</div>
        </>
      }
      footer={
        <>
          <p>Phase 01 — Miami. 50 selected users. Founder-led activation.</p>
          <p>Phase 02 — Miami + NYC. 100 users. Loop validated under variance.</p>
          <p>Phase 03 — Controlled expansion. Subscription conversion proven.</p>
          <p>Earn scale through evidence. No broad retail before proof.</p>
        </>
      }
    />
  );
}
