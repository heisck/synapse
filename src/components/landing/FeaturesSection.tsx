'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { motion, useInView } from 'framer-motion';
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

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const cardVariants = {
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
}: {
  feature: (typeof features)[0];
  index: number;
}) {
  const Icon = feature.icon;
  const isEven = index % 2 === 0;
  const cardRef = useRef<HTMLDivElement>(null);
  const [tiltStyle, setTiltStyle] = useState({ transform: 'translateY(0px)' });

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const y = (e.clientY - rect.top) / rect.height;
    const translateY = (0.5 - y) * -6;
    setTiltStyle({ transform: `translateY(${translateY}px)` });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTiltStyle({ transform: 'translateY(0px)' });
  }, []);

  return (
    <motion.div
      variants={cardVariants}
      className="group relative"
      whileHover={{ y: -6 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Glow border overlay */}
      <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-br from-emerald-500/0 via-teal-400/0 to-emerald-500/0 group-hover:from-emerald-500/40 group-hover:via-teal-400/30 group-hover:to-emerald-500/40 dark:group-hover:from-emerald-400/50 dark:group-hover:via-cyan-400/40 dark:group-hover:to-emerald-400/50 transition-all duration-500 blur-[1px] opacity-0 group-hover:opacity-100 group-hover:shadow-[0_0_20px_rgba(16,185,129,0.15)] dark:group-hover:shadow-[0_0_30px_rgba(16,185,129,0.3),0_0_60px_rgba(16,185,129,0.1)]" />

      <div
        className="relative rounded-2xl glass p-6 sm:p-8 h-full transition-all duration-500 overflow-hidden dark:backdrop-blur-[24px] dark:bg-white/[0.04] dark:border-white/[0.12]"
        style={tiltStyle}
      >
        {/* Gradient accent line at top */}
        <motion.div
          className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500 to-transparent"
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 + index * 0.1, ease: 'easeOut' }}
          style={{ transformOrigin: isEven ? 'left' : 'right' }}
        />

        {/* Subtle background glow on hover */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500/0 to-teal-500/0 group-hover:from-emerald-500/[0.03] group-hover:to-teal-500/[0.03] dark:group-hover:from-emerald-400/[0.08] dark:group-hover:to-cyan-400/[0.05] transition-all duration-500" />

        {/* Icon */}
        <motion.div
          className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-gradient-to-br dark:from-emerald-400/20 dark:to-cyan-400/20 flex items-center justify-center mb-5 group-hover:bg-emerald-200 dark:group-hover:from-emerald-400/30 dark:group-hover:to-cyan-400/30 transition-all duration-300 relative"
          whileHover={{ rotate: [0, -5, 5, 0] }}
          transition={{ duration: 0.4 }}
        >
          <Icon className="w-6 h-6 text-emerald-600 dark:text-emerald-300 transition-transform duration-300 group-hover:scale-110" />
          {/* Pulse ring on hover */}
          <div className="absolute inset-0 rounded-xl border-2 border-emerald-400/0 group-hover:border-emerald-400/30 dark:group-hover:border-emerald-400/50 transition-all duration-500 scale-100 group-hover:scale-125 opacity-0 group-hover:opacity-100" />
        </motion.div>

        <h3 className="text-lg font-semibold mb-2 text-foreground relative z-10">
          {feature.title}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed relative z-10">
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
      <div className="max-w-6xl mx-auto">
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

        {/* Feature Cards Grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
        >
          {features.map((feature, index) => (
            <FeatureCard key={feature.title} feature={feature} index={index} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}