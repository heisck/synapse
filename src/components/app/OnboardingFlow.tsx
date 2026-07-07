'use client';

import { useState, useCallback } from 'react';
import { useAppStore } from '@/stores/appStore';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Eye,
  Ear,
  BookOpen,
  Hand,
  ArrowRight,
  ArrowLeft,
  Check,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const TOTAL_STEPS = 4;

const learningStyles = [
  {
    id: 'visual' as const,
    label: 'Visual',
    icon: Eye,
    description: 'Learn best with diagrams, charts, and visual aids',
    color: 'from-emerald-500 to-teal-500',
    bgLight: 'bg-emerald-50 dark:bg-emerald-950/30',
  },
  {
    id: 'auditory' as const,
    label: 'Auditory',
    icon: Ear,
    description: 'Prefer listening, discussions, and verbal explanations',
    color: 'from-violet-500 to-purple-500',
    bgLight: 'bg-violet-50 dark:bg-violet-950/30',
  },
  {
    id: 'reading' as const,
    label: 'Reading / Writing',
    icon: BookOpen,
    description: 'Excel with text, notes, and written materials',
    color: 'from-amber-500 to-orange-500',
    bgLight: 'bg-amber-50 dark:bg-amber-950/30',
  },
  {
    id: 'kinesthetic' as const,
    label: 'Kinesthetic',
    icon: Hand,
    description: 'Learn by doing, hands-on practice, and movement',
    color: 'from-rose-500 to-pink-500',
    bgLight: 'bg-rose-50 dark:bg-rose-950/30',
  },
];

const paceOptions = [
  { id: 'slow' as const, label: 'Slow & Steady', description: 'Deep dive, no rush' },
  { id: 'steady' as const, label: 'Balanced', description: 'Steady and sustainable' },
  { id: 'fast' as const, label: 'Fast Track', description: 'Accelerated learning' },
];

const topicOptions = [
  'Cell Biology',
  'Data Structures',
  'Physics',
  'Organic Chemistry',
  'World History',
  'Calculus',
  'Creative Writing',
  'Psychology',
];

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-0 pt-4 pb-2">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => {
        const stepNum = i + 1;
        const isCompleted = stepNum < currentStep;
        const isCurrent = stepNum === currentStep;

        return (
          <div key={stepNum} className="flex items-center">
            <div className="flex flex-col items-center">
              <motion.div
                animate={
                  isCurrent
                    ? { scale: [1, 1.15, 1] }
                    : isCompleted
                      ? { scale: 1 }
                      : { scale: 1 }
                }
                transition={
                  isCurrent
                    ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' }
                    : { duration: 0.3 }
                }
                className={`relative flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors duration-300 ${
                  isCurrent
                    ? 'border-primary bg-primary text-primary-foreground'
                    : isCompleted
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : 'border-muted-foreground/30 bg-background/50 text-muted-foreground/50'
                }`}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <span className="text-xs font-bold">{stepNum}</span>
                )}
              </motion.div>
              <motion.span
                initial={false}
                animate={{ opacity: isCurrent ? 1 : 0.4 }}
                className="mt-1.5 text-[10px] font-medium text-muted-foreground"
              >
                {['Welcome', 'Style', 'Pace', 'Done'][i]}
              </motion.span>
            </div>
            {stepNum < TOTAL_STEPS && (
              <div className="mx-2 mt-[-18px] h-0.5 w-8 sm:w-12 overflow-hidden rounded-full bg-muted-foreground/15">
                <motion.div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ width: stepNum < currentStep ? '100%' : '0%' }}
                  transition={{ duration: 0.5, ease: 'easeInOut' }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
    scale: 0.95,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -300 : 300,
    opacity: 0,
    scale: 0.95,
  }),
};

function WelcomeStep({ onNext }: { onNext: () => void }) {
  const features = [
    { icon: Brain, text: 'AI-Powered Learning' },
    { icon: Sparkles, text: 'Adaptive Tutoring' },
    { icon: BookOpen, text: 'Master Any Subject' },
  ];

  return (
    <motion.div
      key="step-1"
      custom={1}
      variants={slideVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="space-y-8"
    >
      <div className="space-y-3 text-center">
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
          className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20"
        >
          <Brain className="h-10 w-10 text-white" />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-3xl font-bold gradient-text"
        >
          Welcome to SynapseLearn
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-muted-foreground max-w-md mx-auto"
        >
          Your personalized AI learning companion. Let&apos;s set up your experience in a few quick steps.
        </motion.p>
      </div>

      <div className="space-y-3 max-w-sm mx-auto">
        {features.map((f, i) => (
          <motion.div
            key={f.text}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + i * 0.1 }}
            className="flex items-center gap-3 p-3 rounded-xl bg-background/50"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <f.icon className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-medium">{f.text}</span>
          </motion.div>
        ))}
      </div>

      <div className="flex flex-col items-center gap-3 pt-2">
        <Button onClick={onNext} size="lg" className="w-full max-w-sm">
          Get Started
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </motion.div>
  );
}

function LearningStyleStep({
  selected,
  onToggle,
  onNext,
  onBack,
  onSkip,
}: {
  selected: string[];
  onToggle: (id: string) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  return (
    <motion.div
      key="step-2"
      custom={1}
      variants={slideVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="space-y-6"
    >
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold">How do you learn best?</h2>
        <p className="text-sm text-muted-foreground">
          Select one or more learning styles that resonate with you
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {learningStyles.map((style, i) => {
          const isSelected = selected.includes(style.id);
          return (
            <motion.button
              key={style.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, type: 'spring', stiffness: 300, damping: 25 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onToggle(style.id)}
              className={`relative text-left p-4 rounded-xl border-2 transition-colors duration-200 ${style.bgLight} ${
                isSelected
                  ? `border-primary bg-primary/5 shadow-sm`
                  : 'border-transparent hover:border-border'
              }`}
            >
              {isSelected && (
                <motion.div
                  layoutId="style-check"
                  className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
                  initial={false}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                >
                  <Check className="h-3 w-3" />
                </motion.div>
              )}
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${style.color} mb-3`}
              >
                <style.icon className="h-5 w-5 text-white" />
              </div>
              <h3 className="font-semibold text-sm">{style.label}</h3>
              <p className="text-xs text-muted-foreground mt-1">{style.description}</p>
            </motion.button>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onSkip}>
            Skip for now
          </Button>
          <Button size="sm" onClick={onNext}>
            Next
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

function PaceAndTopicsStep({
  pace,
  topics,
  onSelectPace,
  onToggleTopic,
  onNext,
  onBack,
  onSkip,
}: {
  pace: string;
  topics: string[];
  onSelectPace: (id: string) => void;
  onToggleTopic: (topic: string) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  return (
    <motion.div
      key="step-3"
      custom={1}
      variants={slideVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="space-y-6"
    >
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold">Pace &amp; Topics</h2>
        <p className="text-sm text-muted-foreground">
          Choose your learning pace and topics of interest
        </p>
      </div>

      {/* Pace selector */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground">Preferred Pace</h3>
        <div className="flex gap-2">
          {paceOptions.map((option) => {
            const isActive = pace === option.id;
            return (
              <motion.button
                key={option.id}
                whileTap={{ scale: 0.97 }}
                onClick={() => onSelectPace(option.id)}
                className={`flex-1 p-3 rounded-xl border-2 text-center transition-colors duration-200 ${
                  isActive
                    ? 'border-primary bg-primary/5'
                    : 'border-transparent bg-background/50 hover:border-border'
                }`}
              >
                <p className={`text-sm font-semibold ${isActive ? 'text-primary' : ''}`}>
                  {option.label}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{option.description}</p>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Topic chips */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground">
          Topics of Interest
          <span className="font-normal text-muted-foreground/60 ml-1">(optional)</span>
        </h3>
        <div className="flex flex-wrap gap-2">
          {topicOptions.map((topic, i) => {
            const isSelected = topics.includes(topic);
            return (
              <motion.button
                key={topic}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.04, type: 'spring', stiffness: 400, damping: 25 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onToggleTopic(topic)}
                className={`px-3.5 py-2 rounded-full text-sm font-medium border transition-all duration-200 ${
                  isSelected
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : 'border-border bg-background/50 text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                {topic}
              </motion.button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onSkip}>
            Skip for now
          </Button>
          <Button size="sm" onClick={onNext}>
            Next
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

function DoneStep({
  styles,
  pace,
  topics,
  onStart,
  onBack,
}: {
  styles: string[];
  pace: string;
  topics: string[];
  onStart: () => void;
  onBack: () => void;
}) {
  const paceLabel = paceOptions.find((p) => p.id === pace)?.label ?? 'Balanced';

  const summaryItems = [
    {
      label: 'Learning Style',
      value: styles.length > 0
        ? styles.map((s) => learningStyles.find((l) => l.id === s)?.label).join(', ')
        : 'Visual',
    },
    { label: 'Pace', value: paceLabel },
    {
      label: 'Topics',
      value: topics.length > 0
        ? topics.join(', ')
        : 'Not selected yet',
    },
  ];

  return (
    <motion.div
      key="step-4"
      custom={1}
      variants={slideVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="space-y-6"
    >
      <div className="text-center space-y-2">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20"
        >
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.5, type: 'spring', stiffness: 300, damping: 20 }}
          >
            <Check className="h-8 w-8 text-white" />
          </motion.div>
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-2xl font-bold"
        >
          You&apos;re all set!
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-sm text-muted-foreground"
        >
          Here&apos;s a summary of your preferences
        </motion.p>
      </div>

      <div className="space-y-3 max-w-sm mx-auto">
        {summaryItems.map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + i * 0.1 }}
            className="flex items-start gap-3 p-3 rounded-xl bg-background/50"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.6 + i * 0.1, type: 'spring', stiffness: 400, damping: 20 }}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 mt-0.5"
            >
              <Check className="h-3 w-3 text-emerald-500" />
            </motion.div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
              <p className="text-sm font-semibold truncate">{item.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <Button size="lg" className="px-8" onClick={onStart}>
          Start Learning
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </motion.div>
  );
}

export function OnboardingFlow() {
  const {
    setOnboardingComplete,
    setUserInfo,
    setLearnerProfile,
    setHardSubjects,
    setBestTeachingStyle,
    navigate,
  } = useAppStore();

  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [selectedPace, setSelectedPace] = useState<string>('steady');
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);

  const goNext = useCallback(() => {
    setDirection(1);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  }, []);

  const goBack = useCallback(() => {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 1));
  }, []);

  const toggleStyle = useCallback((id: string) => {
    setSelectedStyles((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }, []);

  const toggleTopic = useCallback((topic: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  }, []);

  const handleFinish = useCallback(() => {
    const primaryStyle = selectedStyles[0] ?? 'visual';
    setUserInfo('Student', 'student@synapselearn.ai');
    setLearnerProfile({
      learningStyle: primaryStyle as 'visual' | 'auditory' | 'reading' | 'kinesthetic',
      pace: selectedPace as 'slow' | 'steady' | 'fast',
      vocabularySensitive: true,
      prefersStory: true,
      prefersBigPicture: true,
      simpleGrammar: false,
      jargonTolerance: 'medium',
      masteryApproach: 'evidence',
    });
    setHardSubjects(selectedTopics);
    setBestTeachingStyle(selectedStyles.join(', '));
    setOnboardingComplete(true);
    navigate('dashboard');
  }, [selectedStyles, selectedPace, selectedTopics, setUserInfo, setLearnerProfile, setHardSubjects, setBestTeachingStyle, setOnboardingComplete, navigate]);

  const handleSkip = useCallback(() => {
    handleFinish();
  }, [handleFinish]);

  return (
    <div className="min-h-screen mesh-gradient flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-6 sm:p-8 max-w-xl w-full"
      >
        <StepIndicator currentStep={step} />

        <div className="mt-4 overflow-hidden">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            {step === 1 && <WelcomeStep key="s1" onNext={goNext} />}
            {step === 2 && (
              <LearningStyleStep
                key="s2"
                selected={selectedStyles}
                onToggle={toggleStyle}
                onNext={goNext}
                onBack={goBack}
                onSkip={handleSkip}
              />
            )}
            {step === 3 && (
              <PaceAndTopicsStep
                key="s3"
                pace={selectedPace}
                topics={selectedTopics}
                onSelectPace={setSelectedPace}
                onToggleTopic={toggleTopic}
                onNext={goNext}
                onBack={goBack}
                onSkip={handleSkip}
              />
            )}
            {step === 4 && (
              <DoneStep
                key="s4"
                styles={selectedStyles}
                pace={selectedPace}
                topics={selectedTopics}
                onStart={handleFinish}
                onBack={goBack}
              />
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}