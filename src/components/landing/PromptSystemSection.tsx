'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { motion, useInView } from 'framer-motion';
import {
  ArrowRight,
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

gsap.registerPlugin(ScrollTrigger);

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

function FlowConnector({ active }: { active: boolean }) {
  if (!active) return null;

  return (
    <motion.div
      className="hidden lg:flex absolute top-1/2 -translate-y-1/2 z-10 items-center"
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        className="w-6 h-0.5 bg-gradient-to-r from-emerald-400 to-teal-400 dark:from-emerald-400 dark:to-cyan-300 dark:shadow-[0_0_8px_rgba(16,185,129,0.5)]"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        style={{ transformOrigin: 'left' }}
      />
      <motion.div
        animate={{ x: [0, 3, 0] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <ArrowRight className="w-5 h-5 text-emerald-400 dark:text-emerald-300 dark:drop-shadow-[0_0_6px_rgba(16,185,129,0.6)] -ml-1" />
      </motion.div>
    </motion.div>
  );
}

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
      {/* Pulse node indicator at top center */}
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
        <motion.div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: layer.nodeColor }}
          animate={{
            boxShadow: [
              `0 0 4px ${layer.nodeColor}40`,
              `0 0 12px ${layer.nodeColor}60, 0 0 24px ${layer.nodeColor}20`,
              `0 0 4px ${layer.nodeColor}40`,
            ],
          }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            delay: index * 0.6,
            ease: 'easeInOut',
          }}
        />
        {/* Dark mode enhanced glow ring */}
        <div className="absolute inset-0 hidden dark:block">
          <motion.div
            className="w-5 h-5 rounded-full"
            style={{
              backgroundColor: 'transparent',
              boxShadow: `0 0 8px ${layer.nodeColor}60, 0 0 16px ${layer.nodeColor}30`,
            }}
            animate={{
              boxShadow: [
                `0 0 8px ${layer.nodeColor}40, 0 0 16px ${layer.nodeColor}15`,
                `0 0 16px ${layer.nodeColor}80, 0 0 32px ${layer.nodeColor}40, 0 0 48px ${layer.nodeColor}15`,
                `0 0 8px ${layer.nodeColor}40, 0 0 16px ${layer.nodeColor}15`,
              ],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              delay: index * 0.6,
              ease: 'easeInOut',
            }}
          />
        </div>
      </div>

      {/* Flow connector on larger screens */}
      <FlowConnector active={index < layers.length - 1} />

      {/* Card */}
      <motion.div
        className="rounded-2xl glass p-6 h-full transition-all duration-300 overflow-hidden relative dark:backdrop-blur-[24px] dark:bg-white/[0.04] dark:border-white/[0.12]"
        whileHover={{ y: -6, scale: 1.02 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        {/* Hover glow background */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500/0 to-teal-500/0 group-hover:from-emerald-500/[0.04] group-hover:to-teal-500/[0.03] dark:group-hover:from-emerald-400/[0.08] dark:group-hover:to-cyan-400/[0.06] transition-all duration-500" />

        {/* Top accent line */}
        <motion.div
          className="absolute top-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            background: `linear-gradient(90deg, transparent, ${layer.nodeColor}, transparent)`,
          }}
        />

        <div className="relative z-10">
          <motion.div
            className={`w-12 h-12 rounded-xl ${layer.color} flex items-center justify-center mb-4`}
            whileHover={{ rotate: [0, -8, 8, 0] }}
            transition={{ duration: 0.4 }}
          >
            <Icon className="w-6 h-6 transition-transform duration-300 group-hover:scale-110" />
          </motion.div>
          <div className="flex items-center gap-2 mb-2">
            <motion.span
              className="text-xs font-mono text-emerald-500 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded"
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 3, repeat: Infinity, delay: index * 0.5 }}
            >
              L{index + 1}
            </motion.span>
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
      whileHover={{ y: -4, scale: 1.02 }}
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

      <motion.div
        className="relative z-10"
        whileHover={{ x: 2 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      >
        <div className="flex items-center gap-3 mb-3">
          <motion.div
            className="relative"
            animate={{ rotate: [0, 2, -2, 0] }}
            transition={{
              duration: 3,
              repeat: Infinity,
              delay: index * 0.4,
              ease: 'easeInOut',
            }}
          >
            <Icon className="w-5 h-5 text-emerald-500 dark:text-emerald-400 dark:drop-shadow-[0_0_4px_rgba(16,185,129,0.5)]" />
            <motion.div
              className="absolute -inset-2 rounded-full bg-emerald-400/0"
              animate={{
                backgroundColor: [
                  'rgba(16,185,129,0)',
                  'rgba(16,185,129,0.1)',
                  'rgba(16,185,129,0)',
                ],
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                delay: index * 0.6,
              }}
            />
          </motion.div>
          <h4 className="font-semibold text-sm">{principle.title}</h4>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed pl-8">
          {principle.description}
        </p>
      </motion.div>
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