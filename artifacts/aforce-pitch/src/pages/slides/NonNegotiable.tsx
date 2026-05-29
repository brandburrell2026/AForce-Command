import EditorialSlide from "@/components/EditorialSlide";

export default function NonNegotiable() {
  const base = import.meta.env.BASE_URL;
  return (
    <EditorialSlide
      slide={1}
      eyebrow="The Silence"
      heroSrc={`${base}images/bg/16-silence-woman.png`}
      heroObjectPosition="center"
      headline={
        <>
          <div>Performance is</div>
          <div className="text-red font-normal">non-negotiable.</div>
        </>
      }
      support={
        <p>
          It is decided in the quiet — long before the moment ever demands it.
        </p>
      }
    />
  );
}
