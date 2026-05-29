import EditorialSlide from "@/components/EditorialSlide";

export default function AlwaysOn() {
  const base = import.meta.env.BASE_URL;
  return (
    <EditorialSlide
      slide={2}
      eyebrow="Who We Serve"
      heroSrc={`${base}images/bg/02-alwayson-c.png`}
      heroObjectPosition="center"
      headline={
        <>
          <div>Built for people</div>
          <div>who don't get</div>
          <div className="text-red font-normal">to be off.</div>
        </>
      }
      support={
        <p>
          Founders. Athletes. Operators. Creators. People whose performance
          matters every single day.
        </p>
      }
    />
  );
}
