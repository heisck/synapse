'use client';

import { motion } from 'framer-motion';
import { Brain, Github, Twitter, Linkedin } from 'lucide-react';

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Pricing', href: '#pricing' },
];

const socialLinks = [
  { icon: Github, href: '#', label: 'GitHub' },
  { icon: Twitter, href: '#', label: 'Twitter' },
  { icon: Linkedin, href: '#', label: 'LinkedIn' },
];

function AnimatedLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.a
      href={href}
      className={`relative inline-block ${className ?? ''}`}
      whileHover={{ x: 2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      {children}
      <span className="absolute bottom-0 left-0 w-0 h-[1px] bg-emerald-500 transition-all duration-300 group-hover:w-full" />
    </motion.a>
  );
}

function SocialIcon({
  icon: Icon,
  href,
  label,
}: {
  icon: typeof Github;
  href: string;
  label: string;
}) {
  return (
    <motion.a
      href={href}
      aria-label={label}
      className="w-10 h-10 rounded-lg glass-subtle flex items-center justify-center text-muted-foreground transition-colors duration-200 relative overflow-hidden group"
      whileHover={{ scale: 1.15, y: -2 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
    >
      {/* Hover background fill */}
      <motion.div
        className="absolute inset-0 bg-emerald-50 dark:bg-emerald-950/50 rounded-lg"
        initial={{ scale: 0, opacity: 0 }}
        whileHover={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.25 }}
      />
      <Icon className="w-5 h-5 relative z-10 transition-colors duration-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400" />
    </motion.a>
  );
}

export default function Footer() {
  return (
    <footer className="mt-auto">
      {/* Animated gradient top border */}
      <div className="relative h-px overflow-hidden">
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-400 to-transparent"
          initial={{ x: '-100%' }}
          animate={{ x: '100%' }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <motion.div
              className="flex items-center gap-2 mb-4"
              whileHover={{ x: 3 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <motion.div
                className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center"
                whileHover={{ rotate: [0, -10, 10, 0] }}
                transition={{ duration: 0.4 }}
              >
                <Brain className="w-5 h-5 text-white" />
              </motion.div>
              <span className="text-lg font-bold tracking-tight">
                SynapseLearn
              </span>
            </motion.div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              AI-powered adaptive tutoring that transforms how you learn and
              master new concepts.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-foreground mb-4">
              Navigation
            </h4>
            <ul className="space-y-3">
              {navLinks.map((link) => (
                <li key={link.label}>
                  <AnimatedLink
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors duration-200"
                  >
                    <span className="group">{link.label}</span>
                  </AnimatedLink>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-foreground mb-4">
              Company
            </h4>
            <ul className="space-y-3">
              {['About', 'Blog', 'Careers', 'Contact'].map((item) => (
                <li key={item}>
                  <AnimatedLink
                    href="#"
                    className="text-sm text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors duration-200"
                  >
                    <span className="group">{item}</span>
                  </AnimatedLink>
                </li>
              ))}
            </ul>
          </div>

          {/* Social */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-foreground mb-4">
              Connect
            </h4>
            <div className="flex gap-3">
              {socialLinks.map((social) => (
                <SocialIcon
                  key={social.label}
                  icon={social.icon}
                  href={social.href}
                  label={social.label}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-border">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} SynapseLearn. All rights
              reserved.
            </p>
            <div className="flex gap-6">
              <AnimatedLink
                href="#"
                className="text-xs text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors duration-200"
              >
                <span className="group">Privacy Policy</span>
              </AnimatedLink>
              <AnimatedLink
                href="#"
                className="text-xs text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors duration-200"
              >
                <span className="group">Terms of Service</span>
              </AnimatedLink>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}