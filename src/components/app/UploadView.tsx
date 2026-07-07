'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Sparkles,
  ClipboardCheck,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Hash,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useAppStore } from '@/stores/appStore';
import { toast } from 'sonner';

type FileStatus = 'pending' | 'uploading' | 'processing' | 'done' | 'error';

interface UploadFile {
  id: string;
  file: File;
  status: FileStatus;
  progress: number;
  error?: string;
}

const ACCEPTED_TYPES = [
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const ACCEPTED_EXTENSIONS = ['.pptx', '.ppt', '.pdf', '.docx'];
const MAX_SIZE = 50 * 1024 * 1024; // 50MB

const COURSE_CATEGORIES = [
  'Science',
  'Mathematics',
  'Computer Science',
  'Languages',
  'History',
  'Business',
  'Other',
];

interface ExtractedSlide {
  id: string;
  order: number;
  title: string;
  content: string;
  wordCount: number;
}

const stagger = {
  animate: { transition: { staggerChildren: 0.06 } },
};
const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

export function UploadView() {
  const { navigate, setActiveCourse, setActiveSlides, setCurrentQuestions, setQuizScore } = useAppStore();
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCount, setGeneratedCount] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [customCategory, setCustomCategory] = useState<string>('');
  const [showCustomCategory, setShowCustomCategory] = useState(false);
  const [courseTitle, setCourseTitle] = useState<string>('');
  const [titleTouched, setTitleTouched] = useState(false);
  const [extractedSlides, setExtractedSlides] = useState<ExtractedSlide[]>([]);
  const [selectedSlideIds, setSelectedSlideIds] = useState<Set<string>>(new Set());
  const [slidesOpen, setSlidesOpen] = useState(false);
  const [uploadedCourseId, setUploadedCourseId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Default course title from first file
  useEffect(() => {
    if (files.length > 0 && !courseTitle) {
      const firstName = files[0].file.name.replace(/\.[^.]+$/, '');
      setCourseTitle(firstName);
    }
  }, [files, courseTitle]);

  // Select all slides by default after extraction
  useEffect(() => {
    if (extractedSlides.length > 0) {
      setSelectedSlideIds(new Set(extractedSlides.map((s) => s.id)));
    }
  }, [extractedSlides]);

  const effectiveCategory = showCustomCategory && customCategory.trim()
    ? customCategory.trim()
    : selectedCategory;

  const titleError = titleTouched && !courseTitle.trim() ? 'Course title is required' : null;

  const validateFile = (file: File): string | null => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext) && !ACCEPTED_TYPES.includes(file.type)) {
      return `Unsupported file type: ${ext}. Accepted: ${ACCEPTED_EXTENSIONS.join(', ')}`;
    }
    if (file.size > MAX_SIZE) {
      return `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max: 50MB`;
    }
    return null;
  };

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles);
    const uploads: UploadFile[] = arr.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      file,
      status: 'pending' as FileStatus,
      progress: 0,
    }));

    let hasError = false;
    const validated = uploads.map((u) => {
      const err = validateFile(u.file);
      if (err) {
        hasError = true;
        return { ...u, status: 'error' as FileStatus, error: err };
      }
      return u;
    });

    setFiles((prev) => [...prev, ...validated]);
    if (hasError) {
      toast.error('Some files were rejected. Check the list for details.');
    } else {
      toast.success(`${arr.length} file${arr.length !== 1 ? 's' : ''} added.`);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles],
  );

  const simulateUpload = async () => {
    // Validate course title
    setTitleTouched(true);
    if (!courseTitle.trim()) {
      toast.error('Please enter a course title before uploading.');
      return;
    }

    if (!effectiveCategory) {
      toast.error('Please select or create a course category.');
      return;
    }

    const pendingFiles = files.filter((f) => f.status === 'pending' || f.status === 'error');
    if (pendingFiles.length === 0) {
      toast.error('No valid files to upload.');
      return;
    }

    setGeneratedCount(null);
    setExtractedSlides([]);
    setUploadedCourseId(null);

    const allExtractedSlides: ExtractedSlide[] = [];
    let courseId = '';

    for (let i = 0; i < pendingFiles.length; i++) {
      const file = pendingFiles[i];
      const id = file.id;

      setFiles((prev) =>
        prev.map((f) => (f.id === id ? { ...f, status: 'uploading' as FileStatus, progress: 0, error: undefined } : f)),
      );

      try {
        const formData = new FormData();
        formData.append('file', file.file);
        formData.append('category', effectiveCategory);
        formData.append('courseTitle', courseTitle.trim());

        // Simulate progress during real upload
        const progressInterval = setInterval(() => {
          setFiles((prev) =>
            prev.map((f) => {
              if (f.id === id && f.status === 'uploading') {
                return { ...f, progress: Math.min(f.progress + 5, 90) };
              }
              return f;
            }),
          );
        }, 100);

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        clearInterval(progressInterval);

        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: 'Upload failed' }));
          throw new Error(errData.error || 'Upload failed');
        }

        setFiles((prev) =>
          prev.map((f) => (f.id === id ? { ...f, progress: 95 } : f)),
        );

        // Mark as processing
        setFiles((prev) =>
          prev.map((f) => (f.id === id ? { ...f, status: 'processing' as FileStatus, progress: 100 } : f)),
        );

        const data = await res.json();
        courseId = data.courseId || courseId;

        // Extract slides from response
        if (data.slides && Array.isArray(data.slides)) {
          const slides: ExtractedSlide[] = data.slides.map(
            (s: { id?: string; title: string; content: string; order: number }, idx: number) => ({
              id: s.id || `slide-${Date.now()}-${idx}`,
              order: s.order || idx + 1,
              title: s.title,
              content: s.content,
              wordCount: s.content.split(/\s+/).filter(Boolean).length,
            }),
          );
          allExtractedSlides.push(...slides);
        }

        // Done
        setFiles((prev) =>
          prev.map((f) => (f.id === id ? { ...f, status: 'done' as FileStatus } : f)),
        );
      } catch (err) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === id
              ? { ...f, status: 'error' as FileStatus, error: err instanceof Error ? err.message : 'Upload failed' }
              : f,
          ),
        );
      }
    }

    if (allExtractedSlides.length > 0) {
      setExtractedSlides(allExtractedSlides);
      setSlidesOpen(true);
      setUploadedCourseId(courseId);
      toast.success(`Uploaded! ${allExtractedSlides.length} slides extracted.`);
    } else {
      toast.success('All files uploaded successfully!');
    }
  };

  const simulateGenerate = async (forSelected = false) => {
    const doneFiles = files.filter((f) => f.status === 'done');
    if (doneFiles.length === 0) {
      toast.error('Upload files first.');
      return;
    }

    if (forSelected && selectedSlideIds.size === 0) {
      toast.error('Select at least one slide to generate questions.');
      return;
    }

    setIsGenerating(true);
    await new Promise((r) => setTimeout(r, 2000));
    const baseCount = forSelected ? selectedSlideIds.size : extractedSlides.length || doneFiles.length;
    const count = Math.max(Math.floor(Math.random() * 3) + 2, Math.floor(baseCount * 1.5));
    setGeneratedCount(count);
    setIsGenerating(false);
    toast.success(`Generated ${count} questions from ${forSelected ? selectedSlideIds.size : 'all'} slides!`);
  };

  const toggleSlideSelection = (slideId: string) => {
    setSelectedSlideIds((prev) => {
      const next = new Set(prev);
      if (next.has(slideId)) {
        next.delete(slideId);
      } else {
        next.add(slideId);
      }
      return next;
    });
  };

  const toggleAllSlides = () => {
    if (selectedSlideIds.size === extractedSlides.length) {
      setSelectedSlideIds(new Set());
    } else {
      setSelectedSlideIds(new Set(extractedSlides.map((s) => s.id)));
    }
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const statusIcon = (status: FileStatus) => {
    switch (status) {
      case 'pending':
        return <FileText className="h-4 w-4 text-muted-foreground" />;
      case 'uploading':
        return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />;
      case 'done':
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
    }
  };

  return (
    <motion.div
      variants={stagger}
      initial="initial"
      animate="animate"
      className="space-y-6 pt-2 lg:pt-4 pl-14 lg:pl-0"
    >
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-bold">Upload Slides</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Upload your study materials and we&apos;ll generate questions automatically.
        </p>
      </motion.div>

      {/* Course Category & Title */}
      <motion.div variants={fadeUp} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="category-select" className="text-sm font-medium">
              Course Category
            </Label>
            <Select
              value={showCustomCategory ? '__custom__' : selectedCategory}
              onValueChange={(val) => {
                if (val === '__custom__') {
                  setShowCustomCategory(true);
                } else {
                  setShowCustomCategory(false);
                  setSelectedCategory(val);
                }
              }}
            >
              <SelectTrigger id="category-select" className="w-full">
                <SelectValue placeholder="Select Course Category" />
              </SelectTrigger>
              <SelectContent>
                {COURSE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
                <SelectItem value="__custom__">Or create new...</SelectItem>
              </SelectContent>
            </Select>
            <AnimatePresence>
              {showCustomCategory && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Input
                    placeholder="Enter custom category name..."
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    className="mt-2"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="space-y-2">
            <Label htmlFor="course-title" className="text-sm font-medium">
              Course Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="course-title"
              placeholder="Enter course title..."
              value={courseTitle}
              onChange={(e) => setCourseTitle(e.target.value)}
              onBlur={() => setTitleTouched(true)}
              className={titleError ? 'border-destructive focus-visible:ring-destructive/50' : ''}
            />\n            <AnimatePresence>
              {titleError && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="text-xs text-destructive"
                >
                  {titleError}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* Drop Zone */}
      <motion.div variants={fadeUp}>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`relative cursor-pointer rounded-xl border-2 border-dashed p-12 text-center transition-all
            ${isDragOver
              ? 'border-primary bg-primary/5 scale-[1.01]'
              : 'border-border hover:border-primary/50 hover:bg-accent/30'
            }`}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPTED_EXTENSIONS.join(',')}
            className="hidden"
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />
          <div className="flex flex-col items-center gap-3">
            <div className={`h-14 w-14 rounded-2xl flex items-center justify-center transition-colors ${isDragOver ? 'bg-primary/20' : 'bg-primary/10'}`}>
              <Upload className={`h-7 w-7 ${isDragOver ? 'text-primary' : 'text-primary/60'}`} />
            </div>
            <div>
              <p className="font-medium">
                {isDragOver ? 'Drop files here' : 'Drag & drop files here, or click to browse'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Supports {ACCEPTED_EXTENSIONS.join(', ')} — Max 50MB per file
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* File List */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2 max-h-96 overflow-y-auto"
          >
            {files.map((f) => (
              <motion.div
                key={f.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="glass rounded-lg p-3 flex items-center gap-3"
              >
                {statusIcon(f.status)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{f.file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(f.file.size / 1024 / 1024).toFixed(2)}MB
                    {f.status === 'error' && f.error && ` — ${f.error}`}
                  </p>
                  {(f.status === 'uploading' || f.status === 'processing') && (
                    <Progress value={f.status === 'processing' ? 100 : f.progress} className="mt-2 h-1.5" />
                  )}
                </div>
                {f.status === 'done' && (
                  <span className="text-xs text-emerald-600 font-medium">Done</span>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(f.id);
                  }}
                  className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-destructive/10 transition-colors"
                  aria-label={`Remove ${f.file.name}`}
                >
                  <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action Buttons */}
      {files.length > 0 && !generatedCount && (
        <motion.div variants={fadeUp} className="flex flex-wrap gap-3">
          <Button
            onClick={simulateUpload}
            disabled={files.every((f) => f.status === 'done') || files.every((f) => f.status === 'uploading' || f.status === 'processing')}
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Files
          </Button>
          {(extractedSlides.length > 0 || files.some((f) => f.status === 'done')) && (
            <>
              <Button
                onClick={() => simulateGenerate(false)}
                disabled={!files.some((f) => f.status === 'done') || isGenerating}
                variant="outline"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Generate Questions for All
              </Button>
              {extractedSlides.length > 0 && (
                <Button
                  onClick={() => simulateGenerate(true)}
                  disabled={selectedSlideIds.size === 0 || isGenerating}
                  variant="outline"
                  className="text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Generate for Selected ({selectedSlideIds.size})
                </Button>
              )}
            </>
          )}
        </motion.div>
      )}

      {/* Slide Grouping Preview */}
      <AnimatePresence>
        {extractedSlides.length > 0 && !generatedCount && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass rounded-xl overflow-hidden"
          >
            <Collapsible open={slidesOpen} onOpenChange={setSlidesOpen}>
              <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-accent/30 transition-colors">
                <div className="flex items-center gap-2">
                  {slidesOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="font-medium text-sm">
                    Extracted Slides ({extractedSlides.length})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {selectedSlideIds.size}/{extractedSlides.length} selected
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleAllSlides();
                    }}
                  >
                    {selectedSlideIds.size === extractedSlides.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="max-h-96 overflow-y-auto border-t">
                  {extractedSlides.map((slide) => {
                    const isSelected = selectedSlideIds.has(slide.id);
                    const previewTitle = slide.title.length > 50 ? slide.title.slice(0, 50) + '…' : slide.title;
                    return (
                      <motion.div
                        key={slide.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.15 }}
                        className={`flex items-center gap-3 px-4 py-2.5 border-b last:border-b-0 transition-colors cursor-pointer ${
                          isSelected ? 'bg-emerald-50/50' : 'hover:bg-accent/20'
                        }`}
                        onClick={() => toggleSlideSelection(slide.id)}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSlideSelection(slide.id)}
                          className={isSelected ? 'border-emerald-600 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600' : ''}
                        />
                        <div className="flex items-center justify-center h-6 w-6 rounded-md bg-muted text-muted-foreground text-xs font-mono flex-shrink-0">
                          {slide.order}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{previewTitle}</p>
                          <p className="text-xs text-muted-foreground">
                            {slide.wordCount} words
                          </p>
                        </div>
                        <Hash className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0" />
                      </motion.div>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Post-generation Results */}
      <AnimatePresence>
        {generatedCount !== null && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="glass rounded-xl p-6 text-center space-y-4"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 mx-auto">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Questions Generated!</h3>
              <p className="text-muted-foreground text-sm mt-1">
                {generatedCount} questions ready from {files.filter((f) => f.status === 'done').length} file(s)
              </p>
            </div>
            <div className="flex justify-center gap-3">
              <Button
                onClick={() => {
                  setQuizScore(0, generatedCount);
                  navigate('quiz');
                }}
              >
                <ClipboardCheck className="h-4 w-4 mr-2" />
                Take Quiz
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setActiveCourse({
                    id: uploadedCourseId || 'uploaded-' + Date.now(),
                    title: courseTitle.trim() || 'Uploaded Material',
                    description: `${effectiveCategory || 'General'} course from uploaded files`,
                    subject: effectiveCategory || 'General',
                    _count: { slides: extractedSlides.length || files.filter((f) => f.status === 'done').length, enrollments: 1, sessions: 0 },
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  });
                  if (extractedSlides.length > 0) {
                    setActiveSlides(
                      extractedSlides.map((s, idx) => ({
                        id: s.id,
                        courseId: uploadedCourseId || 'uploaded-' + Date.now(),
                        title: s.title,
                        content: s.content,
                        order: s.order,
                        createdAt: new Date().toISOString(),
                      })),
                    );
                  }
                  navigate('dashboard');
                }}
              >
                <BookOpen className="h-4 w-4 mr-2" />
                View Course
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}