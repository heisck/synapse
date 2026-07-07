'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  FileText,
  MessageSquare,
  ClipboardCheck,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useAppStore } from '@/stores/appStore';
import type { Slide } from '@/types';

const MOCK_SLIDES: Slide[] = [
  {
    id: 'slide-1',
    courseId: 'demo',
    title: 'Introduction to Cell Biology',
    content:
      'Cells are the fundamental units of life. All living organisms are composed of one or more cells. The cell theory, developed in the 1830s, states that:\n\n1. All living things are made of cells\n2. Cells are the basic units of structure and function\n3. All cells come from pre-existing cells\n\nThere are two main types of cells: prokaryotic (bacteria, archaea) and eukaryotic (plants, animals, fungi, protists).',
    order: 1,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'slide-2',
    courseId: 'demo',
    title: 'Cell Organelles Overview',
    content:
      'Eukaryotic cells contain membrane-bound organelles, each with specialized functions:\n\n• **Nucleus**: Contains DNA, controls cell activities\n• **Mitochondria**: Produces ATP through cellular respiration\n• **Ribosomes**: Synthesize proteins\n• **Endoplasmic Reticulum**: Synthesizes lipids and proteins (Rough ER has ribosomes, Smooth ER does not)\n• **Golgi Apparatus**: Modifies, sorts, and packages proteins\n• **Lysosomes**: Digest cellular waste and pathogens\n• **Chloroplasts** (plants only): Site of photosynthesis',
    order: 2,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'slide-3',
    courseId: 'demo',
    title: 'Cell Membrane Structure',
    content:
      'The cell membrane (plasma membrane) is a phospholipid bilayer with embedded proteins. According to the Fluid Mosaic Model:\n\n• **Phospholipids** form a double layer with hydrophilic heads facing outward and hydrophobic tails facing inward\n• **Proteins** are embedded in the membrane (integral) or attached to surfaces (peripheral)\n• **Cholesterol** molecules help maintain membrane fluidity\n• **Carbohydrates** attached to proteins form glycoproteins for cell recognition\n\nThe membrane is selectively permeable, allowing certain molecules to pass while blocking others.',
    order: 3,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'slide-4',
    courseId: 'demo',
    title: 'Cell Division: Mitosis',
    content:
      'Mitosis is the process of cell division that produces two genetically identical daughter cells. The phases are:\n\n**PMAT**\n1. **Prophase**: Chromatin condenses into chromosomes, nuclear envelope breaks down\n2. **Metaphase**: Chromosomes align at the cell equator (metaphase plate)\n3. **Anaphase**: Sister chromatids separate and move to opposite poles\n4. **Telophase**: Nuclear envelopes reform, chromosomes decondense\n\nFollowed by **Cytokinesis**: Cytoplasm divides, completing cell division.',
    order: 4,
    createdAt: new Date().toISOString(),
  },
];

const stagger = {
  animate: { transition: { staggerChildren: 0.06 } },
};
const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

export function CourseDetail() {
  const { activeCourse, activeSlides, currentSlideIndex, setCurrentSlideIndex, navigate, setActiveTopic, setActiveSession } =
    useAppStore();

  const slides = activeSlides.length > 0 ? activeSlides : (activeCourse?.slides ?? MOCK_SLIDES);
  const currentSlide = slides[currentSlideIndex] ?? slides[0];
  const [activeSlideId, setActiveSlideId] = useState<string | null>(null);

  const handleSlideSelect = (index: number) => {
    setCurrentSlideIndex(index);
  };

  const handleStartTutor = () => {
    setActiveSession(`session-${Date.now()}`, activeCourse?.id, activeCourse?.title ?? 'Study Session');
    navigate('tutor');
  };

  const handleTakeQuiz = () => {
    navigate('quiz');
  };

  return (
    <motion.div
      variants={stagger}
      initial="initial"
      animate="animate"
      className="space-y-4 pt-2 lg:pt-4 pl-14 lg:pl-0"
    >
      {/* Header */}
      <motion.div variants={fadeUp} className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('dashboard')}
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">{activeCourse?.title ?? 'Course Detail'}</h1>
          {activeCourse?.description && (
            <p className="text-sm text-muted-foreground truncate">{activeCourse.description}</p>
          )}
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <Button size="sm" onClick={handleStartTutor}>
            <MessageSquare className="h-4 w-4 mr-2" />
            Start Tutor
          </Button>
          <Button size="sm" variant="outline" onClick={handleTakeQuiz}>
            <ClipboardCheck className="h-4 w-4 mr-2" />
            Take Quiz
          </Button>
        </div>
      </motion.div>

      {/* Mobile action buttons */}
      <div className="flex sm:hidden gap-2">
        <Button size="sm" className="flex-1" onClick={handleStartTutor}>
          <MessageSquare className="h-4 w-4 mr-2" />
          Start Tutor
        </Button>
        <Button size="sm" variant="outline" className="flex-1" onClick={handleTakeQuiz}>
          <ClipboardCheck className="h-4 w-4 mr-2" />
          Take Quiz
        </Button>
      </div>

      {/* Content area: two panels */}
      <motion.div variants={fadeUp} className="flex flex-col lg:flex-row gap-4 min-h-[60vh]">
        {/* Left panel: slide list */}
        <div className="lg:w-72 shrink-0">
          <div className="glass rounded-xl p-4 lg:sticky lg:top-4">
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">
              Slides ({slides.length})
            </h3>
            <ScrollArea className="max-h-96 lg:max-h-[70vh]">
              <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0">
                {slides.map((slide, i) => (
                  <button
                    key={slide.id}
                    onClick={() => handleSlideSelect(i)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm whitespace-nowrap lg:whitespace-normal transition-colors min-w-[160px] lg:min-w-0 ${
                      i === currentSlideIndex
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-bold bg-muted">
                      {i + 1}
                    </span>
                    <span className="truncate">{slide.title}</span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Right panel: slide content */}
        <div className="flex-1 min-w-0">
          {currentSlide ? (
            <div className="glass rounded-xl p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                    <h2 className="text-lg font-semibold">{currentSlide.title}</h2>
                  </div>
                  <p className="text-xs text-muted-foreground">Slide {currentSlide.order}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveSlideId(activeSlideId === currentSlide.id ? null : currentSlide.id)}
                >
                  <Sparkles className="h-4 w-4 mr-1" />
                  Generate Questions
                </Button>
              </div>

              <Separator />

              {/* Slide content rendered as plain text with basic formatting */}
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {currentSlide.content.split('\n').map((line, i) => {
                  if (!line.trim()) return <br key={i} />;
                  if (line.startsWith('• ') || line.startsWith('- ')) {
                    return (
                      <div key={i} className="flex gap-2 ml-2 py-0.5">
                        <ChevronRight className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                        <span dangerouslySetInnerHTML={{ __html: formatBold(line.slice(2)) }} />
                      </div>
                    );
                  }
                  if (/^\d+\.\s/.test(line)) {
                    return (
                      <div key={i} className="flex gap-2 ml-2 py-0.5">
                        <ChevronRight className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                        <span dangerouslySetInnerHTML={{ __html: formatBold(line.replace(/^\d+\.\s/, '')) }} />
                      </div>
                    );
                  }
                  if (line.startsWith('**') && line.endsWith('**')) {
                    return (
                      <h3 key={i} className="font-semibold text-sm mt-3 mb-1 text-primary">
                        {line.replace(/\*\*/g, '')}
                      </h3>
                    );
                  }
                  return (
                    <p
                      key={i}
                      className="text-sm leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: formatBold(line) }}
                    />
                  );
                })}
              </div>

              {/* Generated questions placeholder */}
              {activeSlideId === currentSlide.id && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg border border-primary/20 bg-primary/5 p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-primary">Questions Generated</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    5 questions generated for &ldquo;{currentSlide.title}&rdquo;.
                    <Button variant="link" size="sm" className="px-1 h-auto font-medium" onClick={handleTakeQuiz}>
                      Take Quiz →
                    </Button>
                  </p>
                </motion.div>
              )}
            </div>
          ) : (
            <div className="glass rounded-xl flex items-center justify-center h-64">
              <p className="text-muted-foreground">Select a slide to view its content</p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

/** Simple markdown bold formatter */
function formatBold(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}