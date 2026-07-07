'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { motion } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/stores/appStore';

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const updateSettings = useAppStore((s) => s.updateSettings);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === 'dark';

  const toggle = useCallback(() => {
    const next = isDark ? 'light' : 'dark';
    setTheme(next);
    updateSettings({ theme: next });
  }, [isDark, setTheme, updateSettings]);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      className={className}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {/* Render a stable icon slot until mounted to avoid hydration mismatch */}
      {mounted && (
        <motion.div
          key={isDark ? 'moon' : 'sun'}
          initial={{ rotate: -30, scale: 0.6, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
        >
          {isDark ? (
            <Moon className="h-5 w-5 text-amber-400" />
          ) : (
            <Sun className="h-5 w-5 text-emerald-600" />
          )}
        </motion.div>
      )}
    </Button>
  );
}
