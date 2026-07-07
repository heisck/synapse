'use client';

import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  trend?: 'up' | 'down';
  change?: string;
}

export function StatsCard({ icon: Icon, label, value, trend, change }: StatsCardProps) {
  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="glass rounded-xl p-4 flex items-center gap-4"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-muted-foreground truncate">{label}</p>
        <div className="flex items-baseline gap-2">
          <p className="text-xl font-bold">{value}</p>
          {trend && change && (
            <span className={`flex items-center gap-0.5 text-xs font-medium ${trend === 'up' ? 'text-emerald-600' : 'text-destructive'}`}>
              {trend === 'up' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {change}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}