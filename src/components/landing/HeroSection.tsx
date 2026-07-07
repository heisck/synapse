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
  { value: '10K+', label: 'Students' },
  { value: '95%', label: 'Mastery Rate' },
  { value: '500+', label: 'Topics' },
  { value: '24/7', label: 'Available' },
];

const fullSubtitle =
  'Experience adaptive AI tutoring that understands your learning style. Upload your materials, and let our intelligent system guide you to mastery with personalized, evidence-based instruction.';

const orbs = [
  {
    size: 'w-[500px] h-[500px] sm:w-[600px] sm:h-[600px]',
    gradient: 'bg-emerald-400/20',
    blur: 'blur-[100px]',
    x: '10%',
    y: '20%',
    animX: [0, 40, -20, 30, 0],
    animY: [0, -30, 20, -10, 0],
    duration: 20,
  },
  {
    size: 'w-[400px] h-[400px] sm:w-[500px] sm:h-[500px]',
    gradient: 'bg-teal-400/15',
    blur: 'blur-[80px]',
    x: '70%',
    y: '60%',
    animX: [0, -30, 20, -40, 0],
    animY: [0, 20, -30, 10, 0],
    duration: 25,
  },
  {
    size: 'w-[300px] h-[300px] sm:w-[400px] sm:h-[400px]',
    gradient: 'bg-emerald-300/10',
    blur: 'blur-[60px]',
    x: '50%',
    y: '10%',
    animX: [0, 20, -40, 10, 0],
    animY: [0, -20, 10, 30, 0],
    duration: 18,
  },
];

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
      {/* Noise texture overlay */}
      <div
        className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundSize: '128px 128px',
        }}
      />

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
        {/* Badge with animated shimmer border */}
        <div ref={badgeRef} className="opacity-0 mb-6 sm:mb-8">
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

        {/* CTA Buttons with glow effects */}
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
            <Button
              size="lg"
              className="relative bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-6 text-base font-semibold rounded-xl shadow-lg shadow-emerald-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/40 hover:-translate-y-0.5"
              onClick={() => navigate('onboarding')}
            >
              <Zap className="mr-2 w-4 h-4" />
              Start Learning
              <ArrowRight className="ml-2 w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
            </Button>
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

        {/* Stats Bar */}
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
                {stat.value}
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