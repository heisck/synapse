'use client';

import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Search, AlertTriangle } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  variant?: 'default' | 'search' | 'error';
}

const springEntrance = {
  initial: { opacity: 0, y: 24, scale: 0.95 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 200,
      damping: 20,
      mass: 0.8,
    },
  },
};

function GradientAccentLine() {
  return (
    <div className="mx-auto mb-5 h-1 w-16 rounded-full bg-gradient-to-r from-primary/60 via-primary to-primary/60 opacity-60" />
  );
}

function DefaultVariant({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: Omit<EmptyStateProps, 'variant'> & { icon: LucideIcon }) {
  return (
    <motion.div
      {...springEntrance}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4"
      >
        <Icon className="h-8 w-8 text-primary" />
      </motion.div>
      <GradientAccentLine />
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} size="sm">
          {actionLabel}
        </Button>
      )}
    </motion.div>
  );
}

function SearchVariant({ title, description, actionLabel, onAction }: Omit<EmptyStateProps, 'variant' | 'icon'>) {
  return (
    <motion.div
      {...springEntrance}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4 overflow-hidden"
      >
        <Search className="h-8 w-8 text-primary" />
        {/* Animated scanning line */}
        <motion.div
          animate={{ y: [-20, 20, -20] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent rounded-full"
        />
      </motion.div>
      <GradientAccentLine />
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} size="sm" variant="outline">
          {actionLabel}
        </Button>
      )}
    </motion.div>
  );
}

function ErrorVariant({ title, description, actionLabel, onAction }: Omit<EmptyStateProps, 'variant' | 'icon'>) {
  return (
    <motion.div
      {...springEntrance}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <motion.div
        animate={{
          y: [0, -6, 0],
          boxShadow: [
            '0 0 5px rgba(245, 158, 11, 0.1)',
            '0 0 24px rgba(245, 158, 11, 0.25)',
            '0 0 5px rgba(245, 158, 11, 0.1)',
          ],
        }}
        transition={{
          y: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
          boxShadow: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
        }}
        className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 mb-4"
      >
        <AlertTriangle className="h-8 w-8 text-amber-500" />
      </motion.div>
      <div className="mx-auto mb-5 h-1 w-16 rounded-full bg-gradient-to-r from-amber-400/60 via-amber-500 to-amber-400/60 opacity-60" />
      <h3 className="text-lg font-semibold mb-1 text-amber-600 dark:text-amber-400">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} size="sm" variant="outline">
          {actionLabel}
        </Button>
      )}
    </motion.div>
  );
}

export function EmptyState({ icon, title, description, actionLabel, onAction, variant = 'default' }: EmptyStateProps) {
  if (variant === 'search') {
    return <SearchVariant title={title} description={description} actionLabel={actionLabel} onAction={onAction} />;
  }

  if (variant === 'error') {
    return <ErrorVariant title={title} description={description} actionLabel={actionLabel} onAction={onAction} />;
  }

  if (!icon) {
    return null;
  }

  return <DefaultVariant icon={icon} title={title} description={description} actionLabel={actionLabel} onAction={onAction} />;
}