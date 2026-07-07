'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight, BookOpen, MessageCircle, Brain, ClipboardCheck, Shield, BookOpenText, Zap, Lock, CheckCircle } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const layers = [
  {
    icon: BookOpen,
    title: 'Discovery Layer',
    description:
      'Analyzes uploaded materials, extracts topics, and maps the knowledge graph for your curriculum.',
    color: 'bg-emerald-100 text-emerald-600',
  },
  {
    icon: MessageCircle,
    title: 'Session Starter',
    description:
      'Crafts the perfect opening — sets context, establishes expectations, and gauges current understanding.',
    color: 'bg-teal-100 text-teal-600',
  },
  {
    icon: Brain,
    title: 'Core Tutor',
    description:
      'The main teaching engine. Adapts explanations, provides Socratic questions, and responds to learner needs.',
    color: 'bg-emerald-100 text-emerald-600',
  },
  {
    icon: ClipboardCheck,
    title: 'Assessment Layer',
    description:
      'Evaluates understanding through varied question types and determines mastery with confidence scoring.',
    color: 'bg-teal-100 text-teal-600',
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

export default function PromptSystemSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.layer-card',
        { opacity: 0, y: 40 },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          stagger: 0.12,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: '.layer-card',
            start: 'top 85%',
            toggleActions: 'play none none none',
          },
        }
      );

      gsap.fromTo(
        '.principle-card',
        { opacity: 0, scale: 0.95 },
        {
          opacity: 1,
          scale: 1,
          duration: 0.5,
          stagger: 0.08,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: '.principles-grid',
            start: 'top 85%',
            toggleActions: 'play none none none',
          },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="relative py-24 sm:py-32 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16 sm:mb-20">
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
          <h3 className="text-xl sm:text-2xl font-semibold mb-8 text-center">
            Four Intelligence Layers
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {layers.map((layer, index) => {
              const Icon = layer.icon;
              return (
                <div
                  key={layer.title}
                  className="layer-card opacity-0 relative group"
                >
                  <div className="rounded-2xl glass p-6 h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-emerald-500/10">
                    <div
                      className={`w-12 h-12 rounded-xl ${layer.color} flex items-center justify-center mb-4`}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-mono text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded">
                        L{index + 1}
                      </span>
                    </div>
                    <h4 className="text-lg font-semibold mb-2">{layer.title}</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {layer.description}
                    </p>
                  </div>
                  {/* Arrow connector on larger screens */}
                  {index < layers.length - 1 && (
                    <div className="hidden lg:flex absolute top-1/2 -right-3 z-10 text-emerald-400">
                      <ArrowRight className="w-6 h-6" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Design Principles */}
        <div>
          <h3 className="text-xl sm:text-2xl font-semibold mb-8 text-center">
            Five Design Principles
          </h3>
          <div className="principles-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {principles.map((principle) => {
              const Icon = principle.icon;
              return (
                <div
                  key={principle.title}
                  className="principle-card opacity-0 rounded-2xl glass-subtle p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:shadow-emerald-500/10"
                >
                  <Icon className="w-5 h-5 text-emerald-500 mb-3" />
                  <h4 className="font-semibold text-sm mb-1">{principle.title}</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {principle.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}