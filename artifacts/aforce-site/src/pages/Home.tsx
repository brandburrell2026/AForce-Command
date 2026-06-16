import { WaveformBackground } from '@/components/WaveformBackground';
import { AmbientAudio } from '@/components/AmbientAudio';

import { HomeNav } from '@/components/home/HomeNav';
import { HeroSection } from '@/components/home/HeroSection';
import { PremiseSection } from '@/components/home/PremiseSection';
import { ProtocolSection } from '@/components/home/ProtocolSection';
import { OperatorsSection } from '@/components/home/OperatorsSection';
import { ProductSection } from '@/components/home/ProductSection';
import { WhitespaceSection } from '@/components/home/WhitespaceSection';
import { ScienceSection } from '@/components/home/ScienceSection';
import { RitualsSection } from '@/components/home/RitualsSection';
import { OSTiersSection } from '@/components/home/OSTiersSection';
import { RetailSection } from '@/components/home/RetailSection';
import { ManifestoSection } from '@/components/home/ManifestoSection';
import { CommerceSection } from '@/components/home/CommerceSection';
import { FinalHeroSection } from '@/components/home/FinalHeroSection';
import { HomeFooter } from '@/components/home/HomeFooter';

export default function Home() {
  return (
    <div className="relative min-h-screen bg-ink text-white overflow-x-clip font-sans antialiased">
      {/* Ambient cinematic layers — degrade gracefully, no interaction */}
      <WaveformBackground />
      <AmbientAudio />

      <HomeNav />

      <main className="relative z-10">
        <HeroSection />
        <PremiseSection />
        <ProtocolSection />
        <OperatorsSection />
        <ProductSection />
        <WhitespaceSection />
        <ScienceSection />
        <RitualsSection />
        <OSTiersSection />
        <RetailSection />
        <ManifestoSection />
        <CommerceSection />
        <FinalHeroSection />
      </main>

      <HomeFooter />
    </div>
  );
}
