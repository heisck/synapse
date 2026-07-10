'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { motion, useInView } from 'framer-motion';
import { FileUp, Brain, MessageSquare, Target } from 'lucide-react';

// Only register GSAP plugins on the client side to avoid SSR/hydration errors
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

const steps = [
  {
    icon: FileUp,
    title: 'Upload Slides',
    description: 'Upload your lecture slides, PDFs, or any learning materials.',
    color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400',
  },
  {
    icon: Brain,
    title: 'AI Analysis',
    description: 'Our AI analyzes content structure, key concepts, and learning objectives.',
    color: 'bg-teal-100 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400',
  },
  {
    icon: MessageSquare,
    title: 'Adaptive Tutoring',
    description: 'Receive personalized instruction that adapts to your understanding level.',
    color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400',
  },
  {
    icon: Target,
    title: 'Mastery Tracking',
    description: 'Track progress through evidence-based assessments until true mastery.',
    color: 'bg-teal-100 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400',
  },
];

function StepCard({
  step,
  index,
}: {
  step: (typeof steps)[0];
  index: number;
}) {
  const Icon = step.icon;

  return (
    <motion.div
      className="relative flex gap-6 sm:gap-8 group"
      initial={{ opacity: 0, x: -30 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{
        duration: 0.6,
        delay: index * 0.15,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {/* Step number circle with floating pulse */}
      <div className="relative z-10 shrink-0">
        <motion.div
          className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full ${step.color} flex items-center justify-center shadow-lg transition-shadow duration-300 group-hover:shadow-emerald-500/20`}
          whileHover={{ scale: 1.1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 15 }}
        >
          <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
        </motion.div>

        {/* Pulse ring behind the icon */}
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-emerald-400/0"
          animate={{
            scale: [1, 1.4, 1.6],
            opacity: [0, 0.3, 0],
            borderColor: ['rgba(16,185,129,0)', 'rgba(16,185,129,0.2)', 'rgba(16,185,129,0)'],
          }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            delay: index * 0.5,
            ease: 'easeOut',
          }}
        />

        {/* Number badge with glow */}
        <motion.div
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center shadow-md z-20"
          animate={{
            boxShadow: [
              '0 2px 8px rgba(16,185,129,0.3)',
              '0 2px 16px rgba(16,185,129,0.5), 0 0 24px rgba(16,185,129,0.15)',
              '0 2px 8px rgba(16,185,129,0.3)',
            ],
          }}
          transition={{ duration: 2, repeat: Infinity, delay: index * 0.3 }}
        >
          {index + 1}
        </motion.div>
      </div>

      {/* Content card with hover effect */}
      <div className="pt-1 sm:pt-3 flex-1">
        <motion.div
          className="p-4 sm:p-5 -m-4 sm:-m-5 rounded-xl transition-all duration-300 group-hover:bg-emerald-50/50 dark:group-hover:bg-emerald-950/20"
          whileHover={{ x: 4 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <h3 className="text-xl sm:text-2xl font-semibold mb-2 text-foreground">
            {step.title}
          </h3>
          <p className="text-muted-foreground text-sm sm:text-base leading-relaxed max-w-md">
            {step.description}
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}

export default function HowItWorksSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
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

      // SVG path drawing animation
      if (pathRef.current) {
        const length = pathRef.current.getTotalLength();
        gsap.set(pathRef.current, {
          strokeDasharray: length,
          strokeDashoffset: length,
        });
        gsap.to(pathRef.current, {
          strokeDashoffset: 0,
          duration: 1.5,
          ease: 'power2.inOut',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 75%',
            toggleActions: 'play none none none',
          },
        });
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative py-24 sm:py-32 px-4 sm:px-6 lg:px-8"
    >
      {/* Subtle background */}
      <div className="absolute inset-0 mesh-gradient opacity-50 pointer-events-none" />

      <div className="relative max-w-4xl mx-auto">
        {/* Section Header */}
        <div ref={headerRef} className="text-center mb-16 sm:mb-20">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">
            How It <span className="gradient-text">Works</span>
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">
            From material upload to mastery — a seamless learning journey
            powered by AI.
          </p>
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* SVG connecting line with path drawing animation */}
          <svg
            className="absolute left-[23px] sm:left-[31px] top-0 h-full w-4 pointer-events-none"
            viewBox="0 0 16 800"
            preserveAspectRatio="none"
            fill="none"
          >
            <defs>
              <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="oklch(0.627 0.194 149.214)" />
                <stop offset="50%" stopColor="oklch(0.687 0.159 177.89)" />
                <stop offset="100%" stopColor="oklch(0.627 0.194 149.214)" />
              </linearGradient>
              <filter id="lineGlow">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <path
              ref={pathRef}
              d="M8 0 C8 200, 8 250, 8 400 C8 550, 8 600, 8 800"
              stroke="url(#lineGradient)"
              strokeWidth="3"
              strokeLinecap="round"
              filter="url(#lineGlow)"
            />
          </svg>

          {/* Traveling dot on the line */}
          {isInView && (
            <motion.div
              className="absolute left-[19px] sm:left-[27px] w-[10px] h-[10px] rounded-full bg-emerald-400"
              style={{ boxShadow: '0 0 12px rgba(16,185,129,0.5)' }}
              animate={{
                top: ['0%', '100%'],
                opacity: [0, 1, 1, 0],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: 'linear',
                delay: 1.5,
              }}
            />
          )}

          {/* Steps */}
          <div className="space-y-12 sm:space-y-16">
            {steps.map((step, index) => (
              <StepCard key={step.title} step={step} index={index} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}