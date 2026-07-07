'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/stores/appStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Eye, Ear, BookOpenText, Hand, Turtle, Footprints, Rabbit, ArrowLeft, ArrowRight, Sparkles } from 'lucide-react'
import type { LearnerProfile } from '@/types'

const TOTAL_STEPS = 5

const learningStyles = [
  { value: 'visual' as const, label: 'Visual', desc: 'Learn with images & diagrams', Icon: Eye },
  { value: 'auditory' as const, label: 'Auditory', desc: 'Learn by listening & discussing', Icon: Ear },
  { value: 'reading' as const, label: 'Reading', desc: 'Learn from text & notes', Icon: BookOpenText },
  { value: 'kinesthetic' as const, label: 'Kinesthetic', desc: 'Learn by doing & practicing', Icon: Hand },
]

const paceOptions = [
  { value: 'slow' as const, label: 'Slow & Steady', desc: 'Take time, no rush', Icon: Turtle },
  { value: 'steady' as const, label: 'Steady Pace', desc: 'Consistent progress', Icon: Footprints },
  { value: 'fast' as const, label: 'Fast Track', desc: 'Quick, intensive', Icon: Rabbit },
]

const slideVariants = {
  enter: (direction: number) => ({ x: direction > 0 ? 300 : -300, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction > 0 ? -300 : 300, opacity: 0 }),
}

export function OnboardingFlow() {
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(0)
  const [name, setName] = useState('')
  const [learningStyle, setLearningStyle] = useState<LearnerProfile['learningStyle'] | null>(null)
  const [pace, setPace] = useState<LearnerProfile['pace'] | null>(null)
  const [prefs, setPrefs] = useState({
    prefersBigPicture: true,
    prefersStory: false,
    vocabularySensitive: false,
    simpleGrammar: true,
  })
  const [hardSubjects, setHardSubjects] = useState('')
  const [alwaysConfuses, setAlwaysConfuses] = useState('')

  const setLearnerProfile = useAppStore((s) => s.setLearnerProfile)
  const setUserInfo = useAppStore((s) => s.setUserInfo)
  const setHardSubjectsStore = useAppStore((s) => s.setHardSubjects)
  const setAlwaysConfusesStore = useAppStore((s) => s.setAlwaysConfuses)
  const navigate = useAppStore((s) => s.navigate)

  const goNext = () => {
    if (step < TOTAL_STEPS - 1) {
      setDirection(1)
      setStep((s) => s + 1)
    }
  }

  const goBack = () => {
    if (step > 0) {
      setDirection(-1)
      setStep((s) => s - 1)
    }
  }

  const canProceed = () => {
    switch (step) {
      case 0: return name.trim().length > 0
      case 1: return learningStyle !== null
      case 2: return pace !== null
      default: return true
    }
  }

  const handleComplete = () => {
    const profile: LearnerProfile = {
      learningStyle: learningStyle!,
      pace: pace!,
      vocabularySensitive: prefs.vocabularySensitive,
      prefersStory: prefs.prefersStory,
      prefersBigPicture: prefs.prefersBigPicture,
      simpleGrammar: prefs.simpleGrammar,
      jargonTolerance: 'medium',
      masteryApproach: 'evidence',
    }
    setUserInfo(name.trim(), '')
    setLearnerProfile(profile)
    if (hardSubjects.trim()) {
      setHardSubjectsStore(hardSubjects.split(',').map((s) => s.trim()).filter(Boolean))
    }
    if (alwaysConfuses.trim()) {
      setAlwaysConfusesStore(alwaysConfuses.trim())
    }
    navigate('dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="flex items-center justify-between mb-8">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <div key={i} className="flex items-center flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                  i < step
                    ? 'bg-emerald-600 text-white'
                    : i === step
                      ? 'bg-emerald-600 text-white ring-4 ring-emerald-100'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {i < step ? '✓' : i + 1}
              </div>
              {i < TOTAL_STEPS - 1 && (
                <div className={`flex-1 h-0.5 mx-2 rounded transition-colors ${i < step ? 'bg-emerald-600' : 'bg-muted'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="relative overflow-hidden min-h-[360px]">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="w-full"
            >
              {step === 0 && (
                <div className="space-y-4 text-center">
                  <h2 className="text-2xl font-bold">What should we call you?</h2>
                  <p className="text-muted-foreground">This helps personalize your learning experience.</p>
                  <Input
                    placeholder="Enter your display name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="text-center text-lg"
                    autoFocus
                  />
                </div>
              )}

              {step === 1 && (
                <div className="space-y-4 text-center">
                  <h2 className="text-2xl font-bold">How do you learn best?</h2>
                  <p className="text-muted-foreground">Pick your preferred learning style.</p>
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    {learningStyles.map(({ value, label, desc, Icon }) => (
                      <Card
                        key={value}
                        className={`cursor-pointer transition-all hover:shadow-md ${
                          learningStyle === value
                            ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 shadow-md'
                            : 'hover:border-emerald-300'
                        }`}
                        onClick={() => setLearningStyle(value)}
                      >
                        <CardContent className="p-4 text-center space-y-2">
                          <Icon className={`w-8 h-8 mx-auto ${learningStyle === value ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                          <div className="font-semibold text-sm">{label}</div>
                          <div className="text-xs text-muted-foreground">{desc}</div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4 text-center">
                  <h2 className="text-2xl font-bold">What&apos;s your preferred pace?</h2>
                  <p className="text-muted-foreground">We&apos;ll adjust the speed of explanations.</p>
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    {paceOptions.map(({ value, label, desc, Icon }) => (
                      <Card
                        key={value}
                        className={`cursor-pointer transition-all hover:shadow-md ${
                          pace === value
                            ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 shadow-md'
                            : 'hover:border-emerald-300'
                        }`}
                        onClick={() => setPace(value)}
                      >
                        <CardContent className="p-4 text-center space-y-2">
                          <Icon className={`w-8 h-8 mx-auto ${pace === value ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                          <div className="font-semibold text-sm">{label}</div>
                          <div className="text-xs text-muted-foreground">{desc}</div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4 text-center">
                  <h2 className="text-2xl font-bold">Any learning preferences?</h2>
                  <p className="text-muted-foreground">Toggle what works best for you.</p>
                  <div className="space-y-4 mt-6 text-left max-w-sm mx-auto">
                    {[
                      { key: 'prefersBigPicture' as const, label: 'Big Picture First', desc: 'Show the overview before diving into details' },
                      { key: 'prefersStory' as const, label: 'Story-based', desc: 'Use stories and real-world examples' },
                      { key: 'vocabularySensitive' as const, label: 'Vocabulary Sensitive', desc: 'Explain unfamiliar terms clearly' },
                      { key: 'simpleGrammar' as const, label: 'Simple Grammar', desc: 'Use straightforward sentences' },
                    ].map(({ key, label, desc }) => (
                      <div key={key} className="flex items-center justify-between gap-3 p-3 rounded-lg border">
                        <div>
                          <Label className="text-sm font-medium">{label}</Label>
                          <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                        </div>
                        <Switch
                          checked={prefs[key]}
                          onCheckedChange={(checked) => setPrefs((p) => ({ ...p, [key]: checked }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-4 text-center">
                  <h2 className="text-2xl font-bold">Almost done!</h2>
                  <p className="text-muted-foreground">Tell us about challenging areas (optional).</p>
                  <div className="space-y-4 mt-4 text-left">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Hard Subjects</Label>
                      <Textarea
                        placeholder="e.g., Organic Chemistry, Linear Algebra, Quantum Mechanics"
                        value={hardSubjects}
                        onChange={(e) => setHardSubjects(e.target.value)}
                        rows={3}
                      />
                      <p className="text-xs text-muted-foreground">Separate with commas</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">What always confuses you?</Label>
                      <Textarea
                        placeholder="e.g., I always mix up mitosis and meiosis"
                        value={alwaysConfuses}
                        onChange={(e) => setAlwaysConfuses(e.target.value)}
                        rows={2}
                      />
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          <Button
            variant="ghost"
            onClick={goBack}
            disabled={step === 0}
            className="gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>

          {step < TOTAL_STEPS - 1 ? (
            <Button onClick={goNext} disabled={!canProceed()} className="gap-1.5">
              Next
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button onClick={handleComplete} className="gap-1.5">
              <Sparkles className="w-4 h-4" />
              Start Learning
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}