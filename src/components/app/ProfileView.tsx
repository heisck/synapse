'use client';

import { motion } from 'framer-motion';
import {
  User,
  Mail,
  Palette,
  Gauge,
  Eye,
  BookOpen,
  MessageSquare,
  Brain,
  LogOut,
  Settings,
  Lightbulb,
  Target,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/stores/appStore';
import { ThemeToggle } from '@/components/shared/ThemeToggle';

const stagger = {
  animate: { transition: { staggerChildren: 0.08 } },
};
const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const styleLabels: Record<string, { icon: typeof Eye; label: string; color: string }> = {
  visual: { icon: Eye, label: 'Visual', color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
  auditory: { icon: MessageSquare, label: 'Auditory', color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400' },
  reading: { icon: BookOpen, label: 'Reading/Writing', color: 'bg-purple-500/10 text-purple-700 dark:text-purple-400' },
  kinesthetic: { icon: Zap, label: 'Kinesthetic', color: 'bg-orange-500/10 text-orange-700 dark:text-orange-400' },
};

const paceLabels: Record<string, { label: string; desc: string }> = {
  slow: { label: 'Slow & Steady', desc: 'Thorough explanations, extra examples' },
  steady: { label: 'Balanced', desc: 'Moderate pace with periodic reviews' },
  fast: { label: 'Fast Track', desc: 'Concise explanations, quick progression' },
};

export function ProfileView() {
  const { userName, userEmail, learnerProfile, navigate, setOnboardingComplete } = useAppStore();

  const initials = userName
    ? userName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'SL';

  const handleReconfigure = () => {
    setOnboardingComplete(false);
    navigate('onboarding');
  };

  const handleSignOut = () => {
    navigate('landing');
  };

  const styleInfo = learnerProfile ? styleLabels[learnerProfile.learningStyle] : null;
  const paceInfo = learnerProfile ? paceLabels[learnerProfile.pace] : null;

  return (
    <motion.div
      variants={stagger}
      initial="initial"
      animate="animate"
      className="space-y-6 pt-2 lg:pt-4 max-w-2xl mx-auto pl-14 lg:pl-0"
    >
      {/* Profile Header */}
      <motion.div variants={fadeUp} className="glass rounded-xl p-6">
        <div className="flex items-start gap-5">
          <Avatar className="h-20 w-20">
            <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold truncate">{userName || 'Student'}</h1>
              <div className="flex items-center gap-1">
                <ThemeToggle />
              </div>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-4 w-4" />
              <p className="text-sm truncate">{userEmail || 'student@synapselearn.ai'}</p>
            </div>
            <Badge variant="secondary" className="mt-2">Free Plan</Badge>
          </div>
        </div>
      </motion.div>

      {/* Learning Profile */}
      <motion.div variants={fadeUp} className="glass rounded-xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Learning Profile</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={handleReconfigure}>
            <Settings className="h-4 w-4 mr-1" />
            Reconfigure
          </Button>
        </div>

        {learnerProfile ? (
          <div className="space-y-4">
            {/* Learning Style */}
            <div className="flex items-center gap-3">
              {styleInfo && (
                <div className={`flex items-center gap-2 rounded-lg px-3 py-2 ${styleInfo.color}`}>
                  <styleInfo.icon className="h-4 w-4" />
                  <span className="text-sm font-medium">{styleInfo.label} Learner</span>
                </div>
              )}
            </div>

            <Separator />

            {/* Pace */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Gauge className="h-4 w-4" />
                <span>Learning Pace</span>
              </div>
              {paceInfo && (
                <div>
                  <p className="font-medium">{paceInfo.label}</p>
                  <p className="text-xs text-muted-foreground">{paceInfo.desc}</p>
                </div>
              )}
            </div>

            <Separator />

            {/* Preferences */}
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                Preferences
              </p>
              <div className="flex flex-wrap gap-2">
                {learnerProfile.prefersStory && (
                  <Badge variant="outline" className="text-xs">Stories & Analogies</Badge>
                )}
                {learnerProfile.prefersBigPicture && (
                  <Badge variant="outline" className="text-xs">Big Picture First</Badge>
                )}
                {learnerProfile.vocabularySensitive && (
                  <Badge variant="outline" className="text-xs">Simple Vocabulary</Badge>
                )}
                {learnerProfile.masteryApproach === 'evidence' && (
                  <Badge variant="outline" className="text-xs">Evidence-Based Mastery</Badge>
                )}
                <Badge variant="outline" className="text-xs">
                  Jargon Tolerance: {learnerProfile.jargonTolerance}
                </Badge>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <Palette className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No learning profile configured yet.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={handleReconfigure}>
              <Target className="h-4 w-4 mr-2" />
              Configure Learning Profile
            </Button>
          </div>
        )}
      </motion.div>

      {/* Actions */}
      <motion.div variants={fadeUp} className="flex flex-wrap gap-3 pb-8">
        <Button variant="outline" onClick={handleReconfigure}>
          <Settings className="h-4 w-4 mr-2" />
          Reconfigure Learning Profile
        </Button>
        <Button variant="outline" className="text-destructive hover:text-destructive" onClick={handleSignOut}>
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </motion.div>
    </motion.div>
  );
}