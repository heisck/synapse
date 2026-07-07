'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface UseCountUpOptions {
  duration?: number;
  delay?: number;
  decimals?: number;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function useCountUp(
  target: string | number,
  options: UseCountUpOptions = {}
): string {
  const { duration = 1500, delay = 0, decimals = 0 } = options;
  const [displayValue, setDisplayValue] = useState('0');

  // Parse the target to extract prefix, numeric value, and suffix
  const parseTarget = useCallback((input: string | number) => {
    const str = String(input);
    let prefix = '';
    let suffix = '';
    let numericStr = str;

    // Extract "+" prefix
    if (numericStr.startsWith('+')) {
      prefix = '+';
      numericStr = numericStr.slice(1);
    }

    // Extract "%" suffix
    if (numericStr.endsWith('%')) {
      suffix = '%';
      numericStr = numericStr.slice(0, -1);
    }

    const numericValue = parseFloat(numericStr) || 0;
    // Determine decimal places from the original string
    const originalDecimals = numericStr.includes('.')
      ? numericStr.split('.')[1].length
      : 0;

    return { prefix, suffix, numericValue, originalDecimals };
  }, []);

  const { prefix, suffix, numericValue, originalDecimals } = parseTarget(target);
  const hasAnimated = useRef(false);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    // Reset if target changes
    if (hasAnimated.current) {
      hasAnimated.current = false;
    }

    const timeout = setTimeout(() => {
      const startTime = performance.now();
      const targetVal = numericValue;
      const decPlaces = originalDecimals > 0 ? originalDecimals : decimals;

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easeOutCubic(progress);
        const currentValue = easedProgress * targetVal;

        setDisplayValue(
          `${prefix}${currentValue.toFixed(decPlaces)}${suffix}`
        );

        if (progress < 1) {
          rafRef.current = requestAnimationFrame(animate);
        } else {
          setDisplayValue(`${prefix}${targetVal.toFixed(decPlaces)}${suffix}`);
          hasAnimated.current = true;
        }
      };

      rafRef.current = requestAnimationFrame(animate);
    }, delay);

    return () => {
      clearTimeout(timeout);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [target, duration, delay, decimals, prefix, suffix, numericValue, originalDecimals]);

  return displayValue;
}