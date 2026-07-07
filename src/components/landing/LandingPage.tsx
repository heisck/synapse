'use client';

import dynamic from 'next/dynamic';
import LenisProvider from './LenisProvider';
import HeroSection from './HeroSection';
import FeaturesSection from './FeaturesSection';
import CTASection from './CTASection';
import Footer from './Footer';

const HowItWorksSection = dynamic(() => import('./HowItWorksSection'), { ssr: false });
const PromptSystemSection = dynamic(() => import('./PromptSystemSection'), { ssr: false });

export function LandingPage() {
  return (
    <LenisProvider>
      <div className="min-h-screen bg-background flex flex-col">
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <PromptSystemSection />
        <CTASection />
        <Footer />
      </div>
    </LenisProvider>
  );
}