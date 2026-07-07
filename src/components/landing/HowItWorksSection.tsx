'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { FileUp, Brain, MessageSquare, Target } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const steps = [
  {
    icon: FileUp,
    title: 'Upload Slides',
    description: 'Upload your lecture slides, PDFs, or any learning materials.',
    color: 'bg-emerald-100 text-emerald-600',
  },
  {
    icon: Brain,
    title: 'AI Analysis',
    description: 'Our AI analyzes content structure, key concepts, and learning objectives.',
    color: 'bg-teal-100 text-teal-600',
  },
  {
    icon: MessageSquare,
    title: 'Adaptive Tutoring',
    description: 'Receive personalized instruction that adapts to your understanding level.',
    color: 'bg-emerald-100 text-emerald-600',
  },
  {
    icon: Target,
    title: 'Mastery Tracking',
    description: 'Track progress through evidence-based assessments until true mastery.',
    color: 'bg-teal-100 text-teal-600',
  },
];

export default function HowItWorksSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Animate each step
      gsap.fromTo(
        '.step-item',
        { opacity: 0, x: -30 },
        {
          opacity: 1,
          x: 0,
          duration: 0.6,
          stagger: 0.2,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 75%',
            toggleActions: 'play none none none',
          },
        }
      );

      // Animate the connecting line
      if (lineRef.current) {
        gsap.fromTo(
          lineRef.current,
          { scaleY: 0 },
          {
            scaleY: 1,
            duration: 1.2,
            ease: 'power2.inOut',
            scrollTrigger: {
              trigger: lineRef.current,
              start: 'top 80%',
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
      {/* Subtle background */}
      <div className="absolute inset-0 mesh-gradient opacity-50 pointer-events-none" />

      <div className="relative max-w-4xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16 sm:mb-20">
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
          {/* Connecting line */}
          <div className="absolute left-6 sm:left-8 top-0 bottom-0 w-0.5">
            <div
              ref={lineRef}
              className="w-full h-full bg-gradient-to-b from-emerald-400 via-teal-400 to-emerald-500 origin-top rounded-full"
            />
          </div>

          {/* Steps */}
          <div className="space-y-12 sm:space-y-16">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="step-item opacity-0 relative flex gap-6 sm:gap-8">
                  {/* Step number circle */}
                  <div className="relative z-10 flex-shrink-0">
                    <div
                      className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full ${step.color} flex items-center justify-center shadow-lg`}
                    >
                      <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center shadow-md">
                      {index + 1}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="pt-1 sm:pt-3">
                    <h3 className="text-xl sm:text-2xl font-semibold mb-2">
                      {step.title}
                    </h3>
                    <p className="text-muted-foreground text-sm sm:text-base leading-relaxed max-w-md">
                      {step.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}