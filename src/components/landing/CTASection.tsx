'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/stores/appStore';

gsap.registerPlugin(ScrollTrigger);

export default function CTASection() {
  const sectionRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const navigate = useAppStore((s) => s.navigate);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        contentRef.current,
        { opacity: 0, y: 40, scale: 0.96 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.8,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 80%',
            toggleActions: 'play none none none',
          },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative py-24 sm:py-32 px-4 sm:px-6 lg:px-8"
    >
      {/* Background */}
      <div className="absolute inset-0 mesh-gradient opacity-60 pointer-events-none" />

      <div className="relative max-w-4xl mx-auto">
        <div
          ref={contentRef}
          className="rounded-3xl glass p-8 sm:p-12 md:p-16 text-center"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 text-emerald-700 text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            Ready to transform your learning?
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Start Your Learning{' '}
            <span className="gradient-text">Journey Today</span>
          </h2>

          <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto mb-8 leading-relaxed">
            Join thousands of students already mastering new concepts with
            adaptive AI tutoring. Upload your first material and experience the
            future of learning.
          </p>

          <Button
            size="lg"
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-10 py-6 text-base font-semibold rounded-xl shadow-lg shadow-emerald-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/30 hover:-translate-y-0.5"
            onClick={() => navigate('onboarding')}
          >
            Start Learning
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>

          <p className="text-xs text-muted-foreground mt-6">
            No credit card required. Free to get started.
          </p>
        </div>
      </div>
    </section>
  );
}