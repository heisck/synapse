'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { gsap } from 'gsap';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import { Sparkles, ArrowRight, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/stores/appStore';

const ParticleField = dynamic(() => import('./ParticleField'), { ssr: false });

const stats = [
  { value: 10000, displayValue: '10K+', label: 'Students', suffix: '' },
  { value: 95, displayValue: '95%', label: 'Mastery Rate', suffix: '%' },
  { value: 500, displayValue: '500+', label: 'Topics', suffix: '+' },
  { value: 24, displayValue: '24/7', label: 'Available', suffix: '/7' },
];

const fullSubtitle =
  'Experience adaptive AI tutoring that understands your learning style. Upload your materials, and let our intelligent system guide you to mastery with personalized, evidence-based instruction.';

const orbs = [
  {
    size: 'w-[500px] h-[500px] sm:w-[600px] sm:h-[600px]',
    gradient: 'bg-emerald-400/20 dark:bg-emerald-400/40',
    blur: 'blur-[100px] dark:blur-[120px]',
    x: '10%',
    y: '20%',
    animX: [0, 40, -20, 30, 0],
    animY: [0, -30, 20, -10, 0],
    duration: 20,
  },
  {
    size: 'w-[400px] h-[400px] sm:w-[500px] sm:h-[500px]',
    gradient: 'bg-teal-400/15 dark:bg-cyan-400/30',
    blur: 'blur-[80px] dark:blur-[100px]',
    x: '70%',
    y: '60%',
    animX: [0, -30, 20, -40, 0],
    animY: [0, 20, -30, 10, 0],
    duration: 25,
  },
  {
    size: 'w-[300px] h-[300px] sm:w-[400px] sm:h-[400px]',
    gradient: 'bg-emerald-300/10 dark:bg-green-300/25',
    blur: 'blur-[60px] dark:blur-[80px]',
    x: '50%',
    y: '10%',
    animX: [0, 20, -40, 10, 0],
    animY: [0, -20, 10, 30, 0],
    duration: 18,
  },
];

// Animated number counter
function AnimatedCounter({ target, displayFormat, isInView }: { target: number; displayFormat: string; isInView: boolean }) {
  const [display, setDisplay] = useState('0');
  const ref = useRef<HTMLSpanElement>(null);
  const hasReducedMotion = useRef(false);
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    hasReducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (hasReducedMotion.current && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      // Use requestAnimationFrame to avoid synchronous setState in effect
      requestAnimationFrame(() => setDisplay(displayFormat));
    }
  }, [displayFormat]);

  useEffect(() => {
    if (!isInView || hasReducedMotion.current) return;

    let start = 0;
    const duration = 1500;
    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * target);
      setDisplay(current.toLocaleString());
      if (progress < 1) requestAnimationFrame(tick);
      else setDisplay(displayFormat);
    }
    requestAnimationFrame(tick);
  }, [isInView, target, displayFormat]);

  return <span ref={ref}>{display}</span>;
}

export default function HeroSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const subRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const navigate = useAppStore((s) => s.navigate);
  const [displayedText, setDisplayedText] = useState('');
  const [typingComplete, setTypingComplete] = useState(false);
  const [showCursor, setShowCursor] = useState(true);
  const [statsInView, setStatsInView] = useState(false);

  const typeText = useCallback(() => {
    let index = 0;
    const interval = setInterval(() => {
      if (index <= fullSubtitle.length) {
        setDisplayedText(fullSubtitle.slice(0, index));
        index++;
      } else {
        clearInterval(interval);
        setTypingComplete(true);
      }
    }, 18);
    return () => clearInterval(interval);
  }, []);

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
        .add(() => typeText(), '-=0.3')
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
  }, [typeText]);

  // Observe stats for counter animation
  useEffect(() => {
    if (!statsRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStatsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, []);

  // Cursor blink
  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 530);
    return () => clearInterval(cursorInterval);
  }, []);

  return (
    <section
      ref={containerRef}
      className="relative min-h-screen flex items-center justify-center overflow-hidden mesh-gradient"
    >
      {/* CSS-only animated gradient mesh background */}
      <div className="gradient-mesh-bg" />

      {/* Noise texture overlay */}
      <div
        className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundSize: '128px 128px',
        }}
      />

      {/* Dark mode starfield effect */}
      <div className="absolute inset-0 z-0 pointer-events-none hidden dark:block">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              radial-gradient(1px 1px at 10% 15%, rgba(16,185,129,0.5) 0%, transparent 100%),
              radial-gradient(1px 1px at 25% 35%, rgba(20,184,166,0.4) 0%, transparent 100%),
              radial-gradient(1.5px 1.5px at 40% 10%, rgba(52,211,153,0.6) 0%, transparent 100%),
              radial-gradient(1px 1px at 55% 55%, rgba(16,185,129,0.3) 0%, transparent 100%),
              radial-gradient(1px 1px at 70% 25%, rgba(20,184,166,0.5) 0%, transparent 100%),
              radial-gradient(1.5px 1.5px at 85% 45%, rgba(110,231,183,0.5) 0%, transparent 100%),
              radial-gradient(1px 1px at 15% 70%, rgba(16,185,129,0.35) 0%, transparent 100%),
              radial-gradient(1px 1px at 30% 85%, rgba(20,184,166,0.3) 0%, transparent 100%),
              radial-gradient(1.5px 1.5px at 60% 75%, rgba(52,211,153,0.45) 0%, transparent 100%),
              radial-gradient(1px 1px at 80% 65%, rgba(16,185,129,0.4) 0%, transparent 100%),
              radial-gradient(1px 1px at 90% 80%, rgba(110,231,183,0.35) 0%, transparent 100%),
              radial-gradient(1px 1px at 5% 90%, rgba(20,184,166,0.3) 0%, transparent 100%),
              radial-gradient(1.5px 1.5px at 45% 40%, rgba(16,185,129,0.55) 0%, transparent 100%),
              radial-gradient(1px 1px at 65% 90%, rgba(52,211,153,0.4) 0%, transparent 100%),
              radial-gradient(1px 1px at 95% 15%, rgba(20,184,166,0.45) 0%, transparent 100%),
              radial-gradient(1px 1px at 50% 50%, rgba(110,231,183,0.3) 0%, transparent 100%)
            `,
          }}
        />
        <motion.div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              radial-gradient(1px 1px at 20% 60%, rgba(52,211,153,0.5) 0%, transparent 100%),
              radial-gradient(1.5px 1.5px at 35% 20%, rgba(16,185,129,0.4) 0%, transparent 100%),
              radial-gradient(1px 1px at 75% 70%, rgba(20,184,166,0.45) 0%, transparent 100%),
              radial-gradient(1px 1px at 8% 45%, rgba(110,231,183,0.35) 0%, transparent 100%),
              radial-gradient(1.5px 1.5px at 92% 35%, rgba(16,185,129,0.5) 0%, transparent 100%),
              radial-gradient(1px 1px at 48% 92%, rgba(52,211,153,0.3) 0%, transparent 100%)
            `,
          }}
          animate={{ opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Animated floating orbs */}
      {orbs.map((orb, i) => (
        <motion.div
          key={i}
          className={`absolute ${orb.size} ${orb.gradient} ${orb.blur} rounded-full pointer-events-none`}
          style={{ left: orb.x, top: orb.y }}
          animate={{ x: orb.animX, y: orb.animY }}
          transition={{
            duration: orb.duration,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}

      {/* Three.js particle field */}
      <ParticleField />

      {/* Content */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-20 sm:py-28">
        {/* Badge: "AI-Powered Learning Platform" */}
        <div ref={badgeRef} className="opacity-0 mb-3 sm:mb-4 flex justify-center gap-3 flex-wrap">
          <motion.span
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full relative overflow-hidden text-sm font-medium text-emerald-700 dark:text-emerald-300"
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            <span className="absolute inset-0 rounded-full glass-subtle" />
            <span className="absolute inset-0 rounded-full overflow-hidden">
              <motion.span
                className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent"
                animate={{ x: ['-200%', '200%'] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                style={{ width: '100%' }}
              />
            </span>
            <Sparkles className="w-4 h-4 relative z-10" />
            <span className="relative z-10">AI-Powered Learning Platform</span>
          </motion.span>

          {/* New: AI Study Plans floating badge with shimmer */}
          <motion.span
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full relative overflow-hidden text-sm font-medium text-amber-700 dark:text-amber-300 border border-amber-300/30 dark:border-amber-500/30 bg-amber-50/80 dark:bg-amber-950/40"
            initial={{ opacity: 0, scale: 0.9, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.6, type: 'spring', stiffness: 300, damping: 25 }}
          >
            <span className="absolute inset-0 rounded-full overflow-hidden">
              <motion.span
                className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-400/30 to-transparent"
                animate={{ x: ['-200%', '200%'] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
                style={{ width: '200%' }}
              />
            </span>
            <Zap className="w-3.5 h-3.5 relative z-10 text-amber-500" />
            <span className="relative z-10 font-semibold">New:</span>
            <span className="relative z-10">AI Study Plans</span>
          </motion.span>
        </div>

        {/* Heading with animated gradient text */}
        <h1
          ref={headingRef}
          className="opacity-0 text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6"
        >
          Learn Anything.{' '}
          <span className="relative inline-block">
            <span className="gradient-text">Master Everything.</span>
            <motion.span
              className="absolute -bottom-1 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500 to-transparent origin-left"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 1.2, delay: 1.2, ease: 'easeOut' }}
            />
          </span>
        </h1>

        {/* Subheading with typing animation */}
        <p
          ref={subRef}
          className="opacity-0 max-w-2xl mx-auto text-base sm:text-lg md:text-xl text-muted-foreground leading-relaxed mb-10 min-h-[4.5em] sm:min-h-[4em]"
        >
          {displayedText}
          <AnimatePresence>
            {!typingComplete && (
              <motion.span
                className="inline-block w-[2px] h-[1.1em] bg-emerald-500 ml-0.5 align-middle"
                animate={{ opacity: showCursor ? 1 : 0 }}
                transition={{ duration: 0.05 }}
              />
            )}
          </AnimatePresence>
        </p>

        {/* CTA Buttons with enhanced gradient border glow */}
        <div ref={ctaRef} className="opacity-0 flex flex-col sm:flex-row items-center justify-center gap-4">
          <motion.div
            className="relative group"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          >
            <motion.div
              className="absolute -inset-[2px] rounded-xl bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 opacity-0 group-hover:opacity-100 blur-sm transition-opacity duration-500"
              animate={
                typingComplete
                  ? {
                      opacity: [0.4, 0.7, 0.4],
                    }
                  : { opacity: 0 }
              }
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <div className="cta-glow-border">
              <Button
                size="lg"
                className="relative bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-6 text-base font-semibold rounded-xl shadow-lg shadow-emerald-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/40 hover:-translate-y-0.5"
                onClick={(e) => {
                  e.stopPropagation();
                  // Use setTimeout to avoid competing with framer-motion exit animations
                  setTimeout(() => navigate('onboarding'), 50);
                }}
              >
                <Zap className="mr-2 w-4 h-4" />
                Start Learning
                <ArrowRight className="ml-2 w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
              </Button>
            </div>
          </motion.div>
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          >
            <Button
              variant="outline"
              size="lg"
              className="px-8 py-6 text-base font-medium rounded-xl border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-500/10"
              onClick={() =>
                document
                  .getElementById('features')
                  ?.scrollIntoView({ behavior: 'smooth' })
              }
            >
              Explore Features
            </Button>
          </motion.div>
        </div>

        {/* Stats Bar with animated counters */}
        <div
          ref={statsRef}
          className="mt-16 sm:mt-20 grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 max-w-3xl mx-auto"
        >
          {stats.map((stat, i) => (
            <motion.div
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
              whileHover={{ scale: 1.05 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <div className="text-2xl sm:text-3xl md:text-4xl font-bold gradient-text">
                {statsInView ? (
                  <AnimatedCounter target={stat.value} displayFormat={stat.displayValue} isInView={statsInView} />
                ) : (
                  stat.displayValue
                )}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground mt-1">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent z-10" />
    </section>
  );
}