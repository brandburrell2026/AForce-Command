import Hero from "./components/Hero";
import Ritual from "./components/Ritual";
import Product from "./components/Product";
import Sticks from "./components/Sticks";
import Philosophy from "./components/Philosophy";
import Founding200 from "./components/Founding200";
import Footer from "./components/Footer";

export default function App() {
  return (
    <>
      {/* Skip link for keyboard users */}
      <a
        href="#hero"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-bone focus:px-4 focus:py-2 focus:font-mono focus:text-xs focus:text-canvas"
      >
        Skip to content
      </a>

      <main>
        <Hero />
        <Ritual />
        <Product />
        <Sticks />
        <Philosophy />
        <Founding200 />
      </main>
      <Footer />
    </>
  );
}
