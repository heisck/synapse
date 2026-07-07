'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Brain, FileUp, ShieldCheck, Layers, Activity, RefreshCw } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const features = [
  {
    icon: Brain,
    title: 'Adaptive AI Tutoring',
    description:
      'Our AI adapts to your learning pace, style, and knowledge gaps in real-time for truly personalized education.',
  },
  {
    icon: FileUp,
    title: 'Slide Intelligence',
    description:
      'Upload your lecture slides and materials. Our AI extracts key concepts to build a tailored curriculum.',
  },
  {
    icon: ShieldCheck,
    title: 'Evidence-Based Mastery',
    description:
      'Track learning through multi-dimensional assessment. Progress only when genuine understanding is confirmed.',
  },
  {
    icon: Layers,
    title: 'Multi-Layer Prompts',
    description:
      'Sophisticated AI prompt architecture ensures context-aware, pedagogically sound responses.',
  },
  {
    icon: Activity,
    title: 'Error Diagnosis',
    description:
      'Identify not just what you got wrong, but why. Receive targeted interventions based on error patterns.',
  },
  {
    icon: RefreshCw,
    title: 'Session Continuity',
    description:
      'Every session builds on previous ones. Your learning journey is seamless and persistent.',
  },
];

export default function FeaturesSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.feature-card',
        { opacity: 0, y: 50 },
        {
          opacity: 1,
          y: 0,
          duration: 0.7,
          stagger: 0.1,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: cardsRef.current,
            start: 'top 80%',
            end: 'bottom 20%',
            toggleActions: 'play none none none',
          },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id="features"
      ref={sectionRef}
      className="relative py-24 sm:py-32 px-4 sm:px-6 lg:px-8"
    >
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Powerful Features for{' '}
            <span className="gradient-text">Deeper Learning</span>
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">
            Built on cutting-edge AI research and proven pedagogical principles
            to transform how you learn.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div
          ref={cardsRef}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="feature-card opacity-0 group rounded-2xl glass p-6 sm:p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-emerald-500/10"
              >
                <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center mb-5 group-hover:bg-emerald-200 transition-colors duration-300">
                  <Icon className="w-6 h-6 text-emerald-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-foreground">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}