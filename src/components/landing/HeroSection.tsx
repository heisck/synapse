'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import dynamic from 'next/dynamic';
import { Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/stores/appStore';

const ParticleField = dynamic(() => import('./ParticleField'), { ssr: false });

const stats = [
  { value: '10K+', label: 'Students' },
  { value: '95%', label: 'Mastery Rate' },
  { value: '500+', label: 'Topics' },
  { value: '24/7', label: 'Available' },
];

export default function HeroSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const subRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const navigate = useAppStore((s) => s.navigate);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      tl.fromTo(
        badgeRef.current,
        { opacity: 0, y: 30, scale: 0.9 },
        { opacity: 1, y: 0, scale: 1, duration: 0.8 }
      )
        .fromTo(
          headingRef.current,
          { opacity: 0, y: 40 },
          { opacity: 1, y: 0, duration: 0.9 },
          '-=0.4'
        )
        .fromTo(
          subRef.current,
          { opacity: 0, y: 30 },
          { opacity: 1, y: 0, duration: 0.8 },
          '-=0.4'
        )
        .fromTo(
          ctaRef.current,
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.7 },
          '-=0.3'
        )
        .fromTo(
          statsRef.current?.children ? Array.from(statsRef.current.children) : [],
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.5, stagger: 0.12 },
          '-=0.2'
        );
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={containerRef}
      className="relative min-h-screen flex items-center justify-center overflow-hidden mesh-gradient"
    >
      {/* Noise texture overlay */}
      <div
        className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundSize: '128px 128px',
        }}
      />

      {/* Three.js particle field */}
      <ParticleField />

      {/* Content */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-20 sm:py-28">
        {/* Badge */}
        <div ref={badgeRef} className="opacity-0 mb-6 sm:mb-8">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-subtle text-sm font-medium text-emerald-700">
            <Sparkles className="w-4 h-4" />
            AI-Powered Learning Platform
          </span>
        </div>

        {/* Heading */}
        <h1
          ref={headingRef}
          className="opacity-0 text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6"
        >
          Learn Anything.{' '}
          <span className="gradient-text">Master Everything.</span>
        </h1>

        {/* Subheading */}
        <p
          ref={subRef}
          className="opacity-0 max-w-2xl mx-auto text-base sm:text-lg md:text-xl text-muted-foreground leading-relaxed mb-10"
        >
          Experience adaptive AI tutoring that understands your learning style.
          Upload your materials, and let our intelligent system guide you to
          mastery with personalized, evidence-based instruction.
        </p>

        {/* CTA Buttons */}
        <div ref={ctaRef} className="opacity-0 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            size="lg"
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-6 text-base font-semibold rounded-xl shadow-lg shadow-emerald-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/30 hover:-translate-y-0.5"
            onClick={() => navigate('onboarding')}
          >
            Start Learning
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="px-8 py-6 text-base font-medium rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-all duration-300"
            onClick={() =>
              document
                .getElementById('features')
                ?.scrollIntoView({ behavior: 'smooth' })
            }
          >
            Explore Features
          </Button>
        </div>

        {/* Stats Bar */}
        <div
          ref={statsRef}
          className="mt-16 sm:mt-20 grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 max-w-3xl mx-auto"
        >
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className={`opacity-0 text-center ${
                i === 0
                  ? 'animate-float'
                  : i === 1
                    ? 'animate-float-delayed'
                    : i === 2
                      ? 'animate-float-slow'
                      : 'animate-float-delayed'
              }`}
            >
              <div className="text-2xl sm:text-3xl md:text-4xl font-bold gradient-text">
                {stat.value}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground mt-1">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent z-10" />
    </section>
  );
}