import EditorialSlide from "@/components/EditorialSlide";

export default function TheRitual() {
  const base = import.meta.env.BASE_URL;
  return (
    <EditorialSlide
      slide={5}
      eyebrow="The Ritual"
      heroSrc={`${base}images/bg/05-ritual.png`}
      headline={
        <>
          <div>A four-beat</div>
          <div className="text-blue font-normal">operating system</div>
          <div>for the moment</div>
          <div>before the moment.</div>
        </>
      }
      footer={
        <>
          <p>Pause — interrupt the noise.</p>
          <p>Hydrate — restore the system.</p>
          <p>Lock in — choose the standard.</p>
          <p>Perform — the outcome follows.</p>
        </>
      }
    />
  );
}
