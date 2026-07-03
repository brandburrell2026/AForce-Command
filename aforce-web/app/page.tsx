import Hero from "@/components/sections/Hero";
import WhyAforce from "@/components/sections/WhyAforce";
import Science from "@/components/sections/Science";
import Ritual from "@/components/sections/Ritual";
import Stories from "@/components/sections/Stories";
import Products from "@/components/sections/Products";
import Membership from "@/components/sections/Membership";
import Manifesto from "@/components/sections/Manifesto";
import Footer from "@/components/sections/Footer";

export default function Home() {
  return (
    <main>
      <Hero />
      <WhyAforce />
      <Science />
      <Ritual />
      <Stories />
      <Products />
      <Membership />
      <Manifesto />
      <Footer />
    </main>
  );
}
