'use client';

import { Component, type ReactNode, type ErrorInfo } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, RotateCcw, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onGoDashboard?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleGoDashboard = () => {
    this.setState({ hasError: false, error: null });
    this.props.onGoDashboard?.();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 180, damping: 22, mass: 0.8 }}
        className="flex h-full min-h-[60vh] items-center justify-center p-4"
      >
        <div className="glass rounded-2xl p-8 max-w-md w-full text-center space-y-5">
          {/* Animated warning icon with pulsing glow */}
          <motion.div
            animate={{
              boxShadow: [
                '0 0 8px rgba(245, 158, 11, 0.1)',
                '0 0 32px rgba(245, 158, 11, 0.3)',
                '0 0 8px rgba(245, 158, 11, 0.1)',
              ],
              scale: [1, 1.05, 1],
            }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10"
          >
            <AlertTriangle className="h-8 w-8 text-amber-500" />
          </motion.div>

          {/* Gradient text heading */}
          <h2 className="gradient-text-animated text-2xl font-bold">
            Something went wrong
          </h2>

          {/* Error message in glass card */}
          <div className="glass-subtle rounded-xl p-4 text-left">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              Error details
            </p>
            <p className="text-sm text-foreground/80 break-words">
              {this.state.error?.message ?? 'An unexpected error occurred.'}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-center gap-3 pt-1">
            <Button onClick={this.handleReset} variant="outline" className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Try Again
            </Button>
            <Button onClick={this.handleGoDashboard} className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Go to Dashboard
            </Button>
          </div>
        </div>
      </motion.div>
    );
  }
}