'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { motion, useInView, type Variants } from 'framer-motion';
import { Brain, FileUp, ShieldCheck, Layers, Activity, RefreshCw } from 'lucide-react';

// Only register GSAP plugins on the client side to avoid SSR/hydration errors
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

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

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 50, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

function FeatureCard({
  feature,
  index,
  isActive,
  onActivate,
}: {
  feature: (typeof features)[0];
  index: number;
  isActive: boolean;
  onActivate: (index: number) => void;
}) {
  const Icon = feature.icon;

  return (
    <motion.div
      variants={cardVariants}
      className={`feature-panel group relative min-w-[11rem] flex-1 focus-within:z-10 ${isActive ? 'is-active' : ''}`}
    >
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isActive}
        onClick={() => onActivate(index)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onActivate(index);
          }
        }}
        className="feature-panel-button group/feature relative flex h-full min-h-[21rem] w-full cursor-pointer flex-col items-center justify-center overflow-hidden px-5 py-8 text-center outline-none transition-colors duration-500 focus-visible:ring-2 focus-visible:ring-emerald-400/70"
      >
        <span className="absolute inset-0 bg-linear-to-br from-emerald-500/[0.02] via-transparent to-cyan-500/[0.03] opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-focus-within:opacity-100" />

        <motion.span
          className="relative z-10 mb-5 flex items-center justify-center text-emerald-600 transition-transform duration-500 dark:text-emerald-300"
          whileHover={{ rotate: [0, -4, 4, 0] }}
          transition={{ duration: 0.45 }}
        >
          <Icon className="feature-panel-icon h-10 w-10 stroke-[1.9] transition-all duration-500 group-hover:h-12 group-hover:w-12 group-hover:text-emerald-500 group-focus-within:h-12 group-focus-within:w-12 dark:group-hover:text-emerald-200 dark:group-focus-within:text-emerald-200" />
        </motion.span>

        <h3 className="feature-panel-title relative z-10 mb-3 max-w-[12rem] text-base font-semibold text-foreground transition-all duration-500">
          {feature.title}
        </h3>
        <p className="feature-panel-copy relative z-10 max-w-[18rem] text-sm leading-relaxed text-muted-foreground">
          {feature.description}
        </p>
      </div>
    </motion.div>
  );
}

export default function FeaturesSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' });
  const [activeFeatureIndex, setActiveFeatureIndex] = useState<number | null>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (headerRef.current) {
        gsap.fromTo(
          headerRef.current.children,
          { opacity: 0, y: 30 },
          {
            opacity: 1,
            y: 0,
            duration: 0.7,
            stagger: 0.15,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: headerRef.current,
              start: 'top 85%',
              toggleActions: 'play none none none',
            },
          }
        );
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id="features"
      ref={sectionRef}
      className="relative py-24 sm:py-32 px-4 sm:px-6 lg:px-8"
    >
      <div className="mx-auto">
        {/* Section Header */}
        <div ref={headerRef} className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Powerful Features for{' '}
            <span className="gradient-text">Deeper Learning</span>
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">
            Built on cutting-edge AI research and proven pedagogical principles
            to transform how you learn.
          </p>
        </div>

        {/* Feature Cards Stack */}
        <motion.div
          className="feature-card-stack glass relative left-1/2 flex w-screen -translate-x-1/2 flex-col overflow-hidden border-y border-emerald-500/15 shadow-[0_24px_80px_rgba(4,120,87,0.08)] dark:border-white/[0.12] dark:bg-white/[0.04] sm:h-[21rem] sm:flex-row"
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
        >
          {features.map((feature, index) => (
            <FeatureCard
              key={feature.title}
              feature={feature}
              index={index}
              isActive={activeFeatureIndex === index}
              onActivate={setActiveFeatureIndex}
            />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
