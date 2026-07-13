'use client';

import { useEffect } from 'react';
import { useTheme } from 'next-themes';

/**
 * Keeps the mobile browser chrome (Android status/address bar + task/nav bar,
 * iOS status bar) in sync with the app's actual theme instead of a fixed
 * color. Values mirror --background in globals.css:
 *   light  oklch(0.995 0.002 155) ≈ #fcfdfc
 *   dark   oklch(0.145 0.015 155) ≈ #141815
 */
const BG = { light: '#fcfdfc', dark: '#141815' } as const;

function setMeta(name: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export function ThemeColorMeta() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const isDark = resolvedTheme === 'dark';
    setMeta('theme-color', isDark ? BG.dark : BG.light);
    // Opaque status bar that follows the theme (black-translucent renders the
    // bar transparent, which read as plain black in dark mode on iOS).
    setMeta('apple-mobile-web-app-status-bar-style', isDark ? 'black' : 'default');
  }, [resolvedTheme]);

  return null;
}
