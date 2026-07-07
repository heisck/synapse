'use client';

import { useAppStore } from '@/stores/appStore';
import { Brain, GraduationCap, BookOpen, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

export function OnboardingFlow() {
  const { setOnboardingComplete, setUserInfo, setLearnerProfile, navigate } = useAppStore();

  const handleQuickStart = () => {
    setUserInfo('Student', 'student@synapselearn.ai');
    setLearnerProfile({
      learningStyle: 'visual',
      pace: 'steady',
      vocabularySensitive: true,
      prefersStory: true,
      prefersBigPicture: true,
      simpleGrammar: false,
      jargonTolerance: 'medium',
      masteryApproach: 'evidence',
    });
    setOnboardingComplete(true);
    navigate('dashboard');
  };

  const steps = [
    { icon: Brain, title: 'AI-Powered Learning', desc: 'Adaptive tutoring that learns how you learn' },
    { icon: BookOpen, title: 'Upload Your Material', desc: 'Import slides, notes, and study materials' },
    { icon: GraduationCap, title: 'Master Any Subject', desc: 'From biology to data structures, we cover it all' },
    { icon: Sparkles, title: 'Track Your Progress', desc: 'Detailed mastery maps and learning analytics' },
  ];

  return (
    <div className="min-h-screen mesh-gradient flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-8 max-w-lg w-full text-center space-y-8"
      >
        <div className="space-y-2">
          <h1 className="text-3xl font-bold gradient-text">Welcome to SynapseLearn</h1>
          <p className="text-muted-foreground">Let&apos;s set up your personalized learning experience</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * i }}
              className="text-left p-4 rounded-xl bg-background/50 space-y-2"
            >
              <step.icon className="h-6 w-6 text-primary" />
              <h3 className="font-semibold text-sm">{step.title}</h3>
              <p className="text-xs text-muted-foreground">{step.desc}</p>
            </motion.div>
          ))}
        </div>

        <Button onClick={handleQuickStart} size="lg" className="w-full">
          Get Started
        </Button>
        <p className="text-xs text-muted-foreground">Quick start with default settings. You can customize later.</p>
      </motion.div>
    </div>
  );
}