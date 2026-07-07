'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { motion, useInView } from 'framer-motion';
import {
  BookOpen,
  MessageCircle,
  Brain,
  ClipboardCheck,
  Shield,
  BookOpenText,
  Zap,
  Lock,
  CheckCircle,
} from 'lucide-react';

// Only register GSAP plugins on the client side to avoid SSR/hydration errors
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

const layers = [
  {
    icon: BookOpen,
    title: 'Discovery Layer',
    description:
      'Analyzes uploaded materials, extracts topics, and maps the knowledge graph for your curriculum.',
    color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400',
    nodeColor: '#10b981',
  },
  {
    icon: MessageCircle,
    title: 'Session Starter',
    description:
      'Crafts the perfect opening — sets context, establishes expectations, and gauges current understanding.',
    color: 'bg-teal-100 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400',
    nodeColor: '#14b8a6',
  },
  {
    icon: Brain,
    title: 'Core Tutor',
    description:
      'The main teaching engine. Adapts explanations, provides Socratic questions, and responds to learner needs.',
    color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400',
    nodeColor: '#10b981',
  },
  {
    icon: ClipboardCheck,
    title: 'Assessment Layer',
    description:
      'Evaluates understanding through varied question types and determines mastery with confidence scoring.',
    color: 'bg-teal-100 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400',
    nodeColor: '#14b8a6',
  },
];

const principles = [
  {
    icon: Shield,
    title: 'No-Block',
    description: 'Always provide a path forward — never leave the learner stuck.',
  },
  {
    icon: BookOpenText,
    title: 'Story-First',
    description: 'Context before content. Make concepts meaningful through narrative.',
  },
  {
    icon: Lock,
    title: 'Safe-Start',
    description: 'Begin with what the learner knows. Build confidence from the start.',
  },
  {
    icon: Zap,
    title: 'Anti-Skip',
    description: 'Ensure prerequisite mastery before advancing to complex topics.',
  },
  {
    icon: CheckCircle,
    title: 'Evidence-Based',
    description: 'Every assessment is grounded in observable learning outcomes.',
  },
];

function LayerCard({
  layer,
  index,
}: {
  layer: (typeof layers)[0];
  index: number;
}) {
  const Icon = layer.icon;

  return (
    <motion.div
      className="layer-card relative group"
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{
        duration: 0.6,
        delay: index * 0.12,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {/* Card */}
      <motion.div
        className="rounded-2xl glass p-6 h-full transition-all duration-300 overflow-hidden relative dark:backdrop-blur-[24px] dark:bg-white/[0.04] dark:border-white/[0.12]"
        whileHover={{ y: -2 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      >
        {/* Hover glow background */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500/0 to-teal-500/0 group-hover:from-emerald-500/[0.04] group-hover:to-teal-500/[0.03] dark:group-hover:from-emerald-400/[0.08] dark:group-hover:to-cyan-400/[0.06] transition-all duration-500" />

        <div className="relative z-10">
          <div className={`w-12 h-12 rounded-xl ${layer.color} flex items-center justify-center mb-4`}>
            <Icon className="w-6 h-6" />
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-mono text-emerald-500 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded">
              L{index + 1}
            </span>
          </div>
          <h4 className="text-lg font-semibold mb-2">{layer.title}</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {layer.description}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

function PrincipleCard({
  principle,
  index,
}: {
  principle: (typeof principles)[0];
  index: number;
}) {
  const Icon = principle.icon;

  return (
    <motion.div
      className="principle-card rounded-2xl glass-subtle p-5 transition-all duration-300 relative overflow-hidden group dark:backdrop-blur-[20px] dark:bg-white/[0.03] dark:border-white/[0.1]"
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: '-30px' }}
      transition={{
        duration: 0.5,
        delay: index * 0.08,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={{ y: -2 }}
    >
      {/* Hover glow */}
      <motion.div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background:
            'linear-gradient(135deg, rgba(16,185,129,0.05) 0%, rgba(20,184,166,0.03) 100%)',
        }}
      />
      {/* Dark mode enhanced hover glow */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 hidden dark:block"
        style={{
          background:
            'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(20,184,166,0.05) 100%)',
          boxShadow: 'inset 0 0 20px rgba(16,185,129,0.05)',
        }}
      />

      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-3">
          <Icon className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
          <h4 className="font-semibold text-sm">{principle.title}</h4>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed pl-8">
          {principle.description}
        </p>
      </div>
    </motion.div>
  );
}

export default function PromptSystemSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const layersHeaderRef = useRef<HTMLHeadingElement>(null);
  const principlesHeaderRef = useRef<HTMLHeadingElement>(null);
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

      if (layersHeaderRef.current) {
        gsap.fromTo(
          layersHeaderRef.current,
          { opacity: 0, y: 20 },
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: layersHeaderRef.current,
              start: 'top 85%',
              toggleActions: 'play none none none',
            },
          }
        );
      }

      if (principlesHeaderRef.current) {
        gsap.fromTo(
          principlesHeaderRef.current,
          { opacity: 0, y: 20 },
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: principlesHeaderRef.current,
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
      ref={sectionRef}
      className="relative py-24 sm:py-32 px-4 sm:px-6 lg:px-8"
    >
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div ref={headerRef} className="text-center mb-16 sm:mb-20">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Intelligent{' '}
            <span className="gradient-text">Prompt Architecture</span>
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">
            Our multi-layered AI system ensures every interaction is
            pedagogically sound, context-aware, and deeply personalized.
          </p>
        </div>

        {/* AI Layers */}
        <div className="mb-16 sm:mb-20">
          <h3
            ref={layersHeaderRef}
            className="text-xl sm:text-2xl font-semibold mb-8 text-center"
          >
            Four Intelligence Layers
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {layers.map((layer, index) => (
              <LayerCard key={layer.title} layer={layer} index={index} />
            ))}
          </div>
        </div>

        {/* Design Principles */}
        <div>
          <h3
            ref={principlesHeaderRef}
            className="text-xl sm:text-2xl font-semibold mb-8 text-center"
          >
            Five Design Principles
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {principles.map((principle, index) => (
              <PrincipleCard
                key={principle.title}
                principle={principle}
                index={index}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}