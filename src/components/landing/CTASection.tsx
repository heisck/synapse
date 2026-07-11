'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { ArrowRight, Sparkles, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/stores/appStore';

// Only register GSAP plugins on the client side to avoid SSR/hydration errors
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

interface Particle {
  id: number;
  x: number;
  y: number;
  angle: number;
  speed: number;
  size: number;
  color: string;
}

function ParticleBurst({ triggerKey }: { triggerKey: number }) {
  const particles = useMemo(() => {
    if (triggerKey === 0) return [];
    const result: Particle[] = [];
    const colors = [
      'rgba(16,185,129,0.8)',
      'rgba(20,184,166,0.7)',
      'rgba(5,150,105,0.6)',
      'rgba(52,211,153,0.7)',
    ];
    for (let i = 0; i < 20; i++) {
      const angle = (Math.PI * 2 * i) / 20 + (Math.random() - 0.5) * 0.5;
      result.push({
        id: i,
        x: 0,
        y: 0,
        angle,
        speed: 40 + Math.random() * 80,
        size: 2 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
    return result;
  }, [triggerKey]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible">
      <AnimatePresence>
        {particles.map((p) => (
          <motion.div
            key={p.id}
            className="absolute rounded-full"
            style={{
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
              left: '50%',
              top: '50%',
            }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{
              x: Math.cos(p.angle) * p.speed,
              y: Math.sin(p.angle) * p.speed,
              opacity: 0,
              scale: 0,
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

export default function CTASection() {
  const sectionRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const navigate = useAppStore((s) => s.navigate);
  const onboardingComplete = useAppStore((s) => s.onboardingComplete);
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' });
  const [burstKey, setBurstKey] = useState(0);
  const handleHover = useCallback(() => {
    setBurstKey((prev) => prev + 1);
  }, []);

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
            stagger: 0.12,
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
      ref={sectionRef}
      className="relative py-24 sm:py-32 px-4 sm:px-6 lg:px-8 overflow-hidden"
    >
      {/* Animated gradient line at top of section */}
      <div className="absolute top-0 left-0 right-0 h-px overflow-hidden">
        <motion.div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(16,185,129,0.6) 30%, rgba(20,184,166,0.4) 50%, rgba(16,185,129,0.6) 70%, transparent 100%)',
            backgroundSize: '200% 100%',
          }}
          animate={{ backgroundPosition: ['100% 0%', '-100% 0%'] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        />
      </div>
      {/* Animated gradient background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-linear-to-br dark:from-emerald-950/50 dark:via-background dark:to-teal-950/50" />
        <motion.div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(16,185,129,0.12) 0%, rgba(20,184,166,0.06) 40%, transparent 70%)',
          }}
          animate={{
            backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute inset-0 hidden dark:block"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(16,185,129,0.18) 0%, rgba(20,184,166,0.10) 40%, transparent 70%)',
          }}
          animate={{
            backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute -inset-20"
          style={{
            background:
              'conic-gradient(from 0deg at 50% 50%, transparent 0%, rgba(16,185,129,0.05) 25%, transparent 50%, rgba(20,184,166,0.04) 75%, transparent 100%)',
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute -inset-20 hidden dark:block"
          style={{
            background:
              'conic-gradient(from 180deg at 50% 50%, transparent 0%, rgba(16,185,129,0.08) 25%, transparent 50%, rgba(52,211,153,0.06) 75%, transparent 100%)',
          }}
          animate={{ rotate: -360 }}
          transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
        />
      </div>

      <div className="relative max-w-4xl mx-auto">
        <motion.div
          ref={headerRef}
          className="rounded-3xl glass p-8 sm:p-12 md:p-16 text-center relative overflow-hidden dark:backdrop-blur-[28px] dark:bg-white/[0.03] dark:border-white/[0.1]"
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Inner glow effect */}
          <motion.div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-50 bg-linear-to-b from-emerald-400/10 dark:from-emerald-400/20 to-transparent rounded-full blur-3xl pointer-events-none"
            animate={{
              opacity: [0.5, 0.8, 0.5],
              scale: [1, 1.1, 1],
            }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* Animated gradient border glow */}
          <motion.div
            className="absolute -inset-px rounded-3xl pointer-events-none"
            style={{
              background:
                'linear-gradient(135deg, rgba(16,185,129,0.3), rgba(20,184,166,0.1), rgba(16,185,129,0.3))',
            }}
            animate={{
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />
          {/* Dark mode enhanced neon border glow */}
          <div className="absolute -inset-px rounded-3xl pointer-events-none hidden dark:block">
            <motion.div
              className="absolute inset-0 rounded-3xl"
              style={{
                background:
                  'linear-gradient(135deg, rgba(16,185,129,0.5), rgba(20,184,166,0.2), rgba(52,211,153,0.5))',
              }}
              animate={{
                opacity: [0.4, 0.8, 0.4],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>

          <div className="relative z-10">
            <motion.div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-sm font-medium mb-6"
              whileHover={{ scale: 1.05 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
              >
                <Sparkles className="w-4 h-4" />
              </motion.div>
              Ready to transform your learning?
            </motion.div>

            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Start Your Learning{' '}
              <span className="gradient-text">Journey Today</span>
            </h2>

            <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto mb-8 leading-relaxed">
              Join thousands of students already mastering new concepts with
              adaptive AI tutoring. Upload your first material and experience the
              future of learning.
            </p>

            {/* CTA Button with pulsing glow and particle burst */}
            <motion.div
              className="relative inline-flex"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              onHoverStart={handleHover}
            >
              <ParticleBurst triggerKey={burstKey} />

              {/* Pulsing glow ring */}
              <motion.div
                className="absolute -inset-3 rounded-2xl bg-emerald-500/10 dark:bg-emerald-400/20 blur-xl"
                animate={{
                  scale: [1, 1.08, 1],
                  opacity: [0.4, 0.7, 0.4],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
              {/* Dark mode neon glow */}
              <div className="absolute -inset-4 rounded-2xl hidden dark:block animate-pulse" style={{ boxShadow: '0 0 30px rgba(16,185,129,0.3), 0 0 60px rgba(16,185,129,0.15), 0 0 90px rgba(16,185,129,0.08)' }} />
              <Button
                size="lg"
                className="relative bg-emerald-600 hover:bg-emerald-700 text-white px-10 py-6 text-base font-semibold rounded-xl shadow-lg shadow-emerald-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/40 hover:-translate-y-0.5 dark:shadow-emerald-500/30 dark:hover:shadow-emerald-500/50"
                onClick={(e) => {
                  e.stopPropagation();
                  // Set-up users go straight in; others do onboarding first
                  setTimeout(() => navigate(onboardingComplete ? 'dashboard' : 'onboarding'), 50);
                }}
              >
                <Zap className="mr-2 w-4 h-4" />
                Start Learning
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </motion.div>

            <p className="text-xs text-muted-foreground mt-6">
              No credit card required. Free to get started.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}