'use client';

import { aiFetch } from '@/lib/aiKey';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
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
  File,
  Presentation,
  Lightbulb,
  FileUp,
  ShieldCheck,
  FlaskConical,
  Calculator,
  Code,
  Languages,
  Landmark,
  Palette,
  Briefcase,
  FolderOpen,
  Check,
  RotateCcw,
  StopCircle,
  Plus,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAppStore } from '@/stores/appStore';
import { toast } from 'sonner';
import { saveLocalCourse } from '@/lib/localLibrary';
import type { Question } from '@/types';

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
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.presentation',
  'application/vnd.oasis.opendocument.text',
  'text/plain',
  'text/markdown',
  'text/csv',
  'text/html',
  'application/rtf',
];

// Must match the server's ALLOWED_EXTENSIONS in /api/upload
const ACCEPTED_EXTENSIONS = ['.pdf', '.pptx', '.docx', '.odp', '.odt', '.txt', '.md', '.csv', '.rtf', '.html'];
const MAX_SIZE = 50 * 1024 * 1024; // 50MB

export const COURSE_CATEGORIES = [
  'Science',
  'Mathematics',
  'Computer Science',
  'Languages',
  'History',
  'Arts',
  'Business',
  'Other',
] as const;

export const CATEGORY_CONFIG: Record<string, { icon: typeof FlaskConical; color: string; chipClass: string; stripeColor: string; barColor: string }> = {
  'Science': { icon: FlaskConical, color: 'emerald', chipClass: 'category-chip-science', stripeColor: 'bg-emerald-500', barColor: 'oklch(0.627 0.194 149.214)' },
  'Mathematics': { icon: Calculator, color: 'teal', chipClass: 'category-chip-mathematics', stripeColor: 'bg-teal-500', barColor: 'oklch(0.627 0.194 177.89)' },
  'Computer Science': { icon: Code, color: 'cyan', chipClass: 'category-chip-computer-science', stripeColor: 'bg-cyan-500', barColor: 'oklch(0.687 0.159 220)' },
  'Languages': { icon: Languages, color: 'amber', chipClass: 'category-chip-languages', stripeColor: 'bg-amber-500', barColor: 'oklch(0.752 0.145 85)' },
  'History': { icon: Landmark, color: 'orange', chipClass: 'category-chip-history', stripeColor: 'bg-orange-500', barColor: 'oklch(0.687 0.159 60)' },
  'Arts': { icon: Palette, color: 'pink', chipClass: 'category-chip-arts', stripeColor: 'bg-pink-500', barColor: 'oklch(0.687 0.159 340)' },
  'Business': { icon: Briefcase, color: 'indigo', chipClass: 'category-chip-business', stripeColor: 'bg-indigo-500', barColor: 'oklch(0.565 0.194 265)' },
  'Other': { icon: FolderOpen, color: 'gray', chipClass: 'category-chip-other', stripeColor: 'bg-gray-400', barColor: 'oklch(0.7 0.015 155)' },
};

interface ExtractedSlide {
  id: string;
  order: number;
  title: string;
  content: string;
  wordCount: number;
}

interface UploadHistoryItem {
  id: string;
  fileName: string;
  fileSize: number;
  category: string;
  status: FileStatus;
  timestamp: number;
  courseId?: string;
}

const stagger: Variants = {
  animate: { transition: { staggerChildren: 0.06 } },
};
const fadeUp: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

// File type config
const FILE_TYPE_CONFIG: Record<string, { icon: typeof File; color: string; bg: string }> = {
  '.pdf': { icon: FileText, color: 'text-red-500', bg: 'bg-red-500/10' },
  '.pptx': { icon: Presentation, color: 'text-orange-500', bg: 'bg-orange-500/10' },
  '.odp': { icon: Presentation, color: 'text-orange-500', bg: 'bg-orange-500/10' },
  '.docx': { icon: File, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  '.odt': { icon: File, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  '.txt': { icon: FileText, color: 'text-slate-500', bg: 'bg-slate-500/10' },
  '.md': { icon: FileText, color: 'text-slate-500', bg: 'bg-slate-500/10' },
  '.csv': { icon: FileText, color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
  '.rtf': { icon: FileText, color: 'text-slate-500', bg: 'bg-slate-500/10' },
  '.html': { icon: FileText, color: 'text-amber-600', bg: 'bg-amber-500/10' },
};

// Floating particles for upload zone
function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 6 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1.5 h-1.5 rounded-full bg-primary/20"
          style={{
            left: `${15 + i * 15}%`,
            top: `${20 + (i % 3) * 25}%`,
          }}
          animate={{
            y: [0, -20, 0],
            opacity: [0.2, 0.6, 0.2],
          }}
          transition={{
            duration: 3 + i * 0.5,
            repeat: Infinity,
            delay: i * 0.3,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

// Quick Tips component
function QuickTips() {
  const tips = [
    { icon: FileUp, text: 'Upload multiple files at once by selecting them together' },
    { icon: Lightbulb, text: 'PDF and PPTX files yield the best question generation results' },
    { icon: ShieldCheck, text: 'All files are processed locally and kept private' },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, type: 'spring', stiffness: 200, damping: 25 }}
      className="glass rounded-xl p-5 space-y-3 card-shadow gradient-border gradient-border-static"
    >
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-amber-500" />
        Quick Tips
      </h3>
      <div className="space-y-2.5">
        {tips.map((tip, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 + idx * 0.1 }}
            className="flex items-start gap-2.5 text-sm text-muted-foreground"
          >
            <tip.icon className="h-4 w-4 text-emerald-500/60 shrink-0 mt-0.5" />
            <span>{tip.text}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// Batch upload progress panel
function BatchProgressPanel({ files, onCancel }: { files: UploadFile[]; onCancel: () => void }) {
  const total = files.length;
  const completed = files.filter((f) => f.status === 'done').length;
  const inProgress = files.filter((f) => f.status === 'uploading' || f.status === 'processing').length;
  const failed = files.filter((f) => f.status === 'error').length;
  const overallProgress = total > 0 ? Math.round(((completed + failed) / total) * 100) : 0;

  if (total <= 1) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="glass rounded-xl p-4 space-y-3 card-shadow"
    >
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Upload Progress</h4>
        <span className="text-xs text-muted-foreground">
          {completed}/{total} completed
          {failed > 0 && <span className="text-destructive ml-1">({failed} failed)</span>}
        </span>
      </div>

      {/* Overall progress bar */}
      <div className="relative h-2 w-full rounded-full bg-muted/50 overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full overflow-hidden"
          style={{
            background: failed > 0
              ? 'linear-gradient(90deg, oklch(0.627 0.194 149.214), oklch(0.687 0.159 177.89), oklch(0.55 0.2 25))'
              : 'linear-gradient(90deg, oklch(0.627 0.194 149.214), oklch(0.687 0.159 177.89))',
          }}
          animate={{ width: `${overallProgress}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <motion.div
            className="absolute inset-0 -translate-x-full"
            animate={{ translateX: ['-100%', '100%', '200%'] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)' }}
          />
        </motion.div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-emerald-500" />
          {completed} completed
        </span>
        <span className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          {inProgress} in progress
        </span>
        {failed > 0 && (
          <span className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-destructive" />
            {failed} failed
          </span>
        )}
      </div>

      {/* Per-file progress */}
      <div className="space-y-1.5 max-h-32 overflow-y-auto">
        {files.map((f) => (
          <div key={f.id} className="flex items-center gap-2 text-xs">
            <span className="truncate flex-1 max-w-45" title={f.file.name}>
              {f.file.name}
            </span>
            {f.status === 'uploading' || f.status === 'processing' ? (
              <div className="flex items-center gap-1.5 w-20 shrink-0">
                <div className="flex-1 h-1 rounded-full bg-muted/50 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-primary"
                    animate={{ width: `${f.progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <span className="text-muted-foreground w-8 text-right">{f.progress}%</span>
              </div>
            ) : f.status === 'done' ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            ) : f.status === 'error' ? (
              <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
            ) : (
              <div className="h-3.5 w-3.5 shrink-0" />
            )}
          </div>
        ))}
      </div>

      {/* Cancel button */}
      {inProgress > 0 && (
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={onCancel}
          >
            <StopCircle className="h-3.5 w-3.5 mr-1.5" />
            Cancel Remaining
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
}

// Upload history panel
function UploadHistoryPanel({ history, onReupload }: { history: UploadHistoryItem[]; onReupload: (item: UploadHistoryItem) => void }) {
  if (history.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 25 }}
      className="glass rounded-xl overflow-hidden card-shadow"
    >
      <div className="p-4 border-b border-border/50">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          Upload History
        </h4>
      </div>
      <div className="max-h-64 overflow-y-auto divide-y divide-border/30">
        {history.map((item, idx) => {
          const config = CATEGORY_CONFIG[item.category];
          const CatIcon = config?.icon || FolderOpen;
          const isFailed = item.status === 'error';
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.08, type: 'spring', stiffness: 300, damping: 25 }}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/20 transition-colors hover-lift"
            >
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isFailed ? 'bg-destructive/10' : 'bg-emerald-500/10'}`}>
                {isFailed
                  ? <AlertCircle className="h-4 w-4 text-destructive" />
                  : <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{item.fileName}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-muted-foreground">{formatFileSize(item.fileSize)}</span>
                  <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0 rounded-full ${config?.chipClass || 'category-chip-other'}`}>
                    <CatIcon className="h-2.5 w-2.5" />
                    {item.category}
                  </span>
                </div>
              </div>
              {isFailed && (
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => onReupload(item)}
                  className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-accent transition-colors shrink-0"
                  aria-label="Re-upload"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
                </motion.button>
              )}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

const UPLOAD_TIMEOUT_MS = 30_000;
const UPLOAD_MAX_RETRIES = 2;

/** POST with a timeout and automatic retry on network glitches (not on real server error responses). */
async function fetchWithRetry(url: string, body: FormData): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= UPLOAD_MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
    try {
      const res = await fetch(url, { method: 'POST', body, signal: controller.signal });
      clearTimeout(timeout);
      return res;
    } catch (err) {
      clearTimeout(timeout);
      lastError = err;
      if (attempt < UPLOAD_MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
    }
  }
  throw lastError instanceof Error
    ? new Error(`Network error after ${UPLOAD_MAX_RETRIES + 1} attempts: ${lastError.message}`)
    : new Error('Network error: could not reach the server.');
}

export function UploadView() {
  const { navigate, activeCourse, setActiveCourse, setActiveSlides, setCurrentQuestions, setQuizScore, setCourseCategory, addCourse, setActiveSession } = useAppStore();
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
  const [uploadHistory, setUploadHistory] = useState<UploadHistoryItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const abortRef = useRef(false);
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

  const cancelUpload = useCallback(() => {
    abortRef.current = true;
    setFiles((prev) =>
      prev.map((f) => {
        if (f.status === 'pending') {
          return { ...f, status: 'error' as FileStatus, error: 'Cancelled' };
        }
        return f;
      }),
    );
    toast.info('Remaining uploads cancelled.');
  }, []);

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
    setIsUploading(true);
    abortRef.current = false;

    const allExtractedSlides: ExtractedSlide[] = [];
    let courseId = '';

    const newHistory: UploadHistoryItem[] = [];

    for (let i = 0; i < pendingFiles.length; i++) {
      if (abortRef.current) break;

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
        // Local-first (ROADMAP Phase 2): the server only parses; the course
        // is stored in THIS browser's IndexedDB, never in the shared DB.
        formData.append('persist', '0');

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

        const res = await fetchWithRetry('/api/upload', formData);

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

        // Add to history
        newHistory.push({
          id: `hist-${Date.now()}-${i}`,
          fileName: file.file.name,
          fileSize: file.file.size,
          category: effectiveCategory,
          status: 'done',
          timestamp: Date.now(),
          courseId,
        });
      } catch (err) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === id
              ? { ...f, status: 'error' as FileStatus, error: err instanceof Error ? err.message : 'Upload failed' }
              : f,
          ),
        );

        newHistory.push({
          id: `hist-${Date.now()}-${i}`,
          fileName: file.file.name,
          fileSize: file.file.size,
          category: effectiveCategory,
          status: 'error',
          timestamp: Date.now(),
        });
      }
    }

    // Set course category and populate the global course list immediately —
    // without this, the Dashboard/CourseDetail never see the new course until
    // a full page reload re-fetches /api/courses.
    if (courseId) {
      setCourseCategory(courseId, effectiveCategory);

      const now = new Date().toISOString();
      const newCourse = {
        id: courseId,
        title: courseTitle.trim() || 'Uploaded Material',
        description: `${effectiveCategory || 'General'} course from uploaded files`,
        subject: effectiveCategory || 'General',
        _count: { slides: allExtractedSlides.length, enrollments: 0, sessions: 0 },
        createdAt: now,
        updatedAt: now,
      };
      addCourse(newCourse);
      setActiveCourse(newCourse);
      const slideRecords = allExtractedSlides.map((s, idx) => ({
        id: s.id,
        courseId,
        title: s.title,
        content: s.content,
        order: s.order || idx + 1,
        createdAt: now,
      }));
      if (slideRecords.length > 0) {
        setActiveSlides(slideRecords);
      }
      // Persist to the browser's own library so the course survives reloads
      saveLocalCourse(newCourse, slideRecords).catch(() => {
        toast.error('Could not save the course to this browser — it will disappear on reload.');
      });
    }

    setUploadHistory((prev) => [...newHistory, ...prev]);
    setIsUploading(false);

    if (allExtractedSlides.length > 0) {
      setExtractedSlides(allExtractedSlides);
      setSlidesOpen(true);
      toast.success(`Uploaded! ${allExtractedSlides.length} slides extracted.`);
    } else if (newHistory.some((h) => h.status === 'done')) {
      toast.success('All files uploaded successfully!');
    }
  };

  const handleReupload = useCallback((_item: UploadHistoryItem) => {
    inputRef.current?.click();
  }, []);

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

    if (!activeCourse) {
      toast.error('No course selected to generate questions for.');
      return;
    }

    setIsGenerating(true);
    try {
      const body: { courseId?: string; content?: string } = {};
      if (forSelected) {
        const selected = extractedSlides.filter((s) => selectedSlideIds.has(s.id));
        body.content = selected.map((s) => `${s.title}\n${s.content}`).join('\n\n');
      } else {
        body.courseId = activeCourse.id;
        // Local courses aren't in the shared DB — the content rides along
        body.content = extractedSlides.map((s) => `## ${s.title}\n${s.content}`).join('\n\n');
      }

      const res = await aiFetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to generate questions.' }));
        throw new Error(err.error || 'Failed to generate questions.');
      }

      const data = await res.json();
      const questions = data.questions as Question[];
      setCurrentQuestions(questions);
      setGeneratedCount(questions.length);
      toast.success(`Generated ${questions.length} questions from ${forSelected ? selectedSlideIds.size : 'all'} slides!`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate questions. Please try again.');
    } finally {
      setIsGenerating(false);
    }
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

  const statusIcon = (status: FileStatus, fileName: string) => {
    const ext = '.' + (fileName.split('.').pop()?.toLowerCase() || '');
    const typeConfig = FILE_TYPE_CONFIG[ext];
    const TypeIcon = typeConfig?.icon || FileText;
    const typeColor = typeConfig?.color || 'text-muted-foreground';

    switch (status) {
      case 'pending':
        return <TypeIcon className={`h-5 w-5 ${typeColor}`} />;
      case 'uploading':
        return <Loader2 className="h-5 w-5 text-primary animate-spin" />;
      case 'processing':
        return (
          <div className="relative">
            <Loader2 className="h-5 w-5 text-emerald-500 animate-spin" />
            <div className="absolute inset-0 animate-ping opacity-20">
              <Loader2 className="h-5 w-5 text-emerald-500" />
            </div>
          </div>
        );
      case 'done':
        return <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300 }}><CheckCircle2 className="h-5 w-5 text-emerald-500" /></motion.div>;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-destructive" />;
    }
  };

  const getFileExt = (fileName: string) => '.' + (fileName.split('.').pop()?.toLowerCase() || '');

  return (
    <motion.div
      variants={stagger}
      initial="initial"
      animate="animate"
      className="space-y-6 pt-2 lg:pt-4 pb-24 sm:pb-6"
    >
      {/* Gradient header */}
      <motion.div
        variants={fadeUp}
        className="rounded-xl p-6 mesh-gradient gradient-border gradient-border-static overflow-hidden"
      >
        <FloatingParticles />
        <div className="relative z-10">
          <h1 className="text-2xl font-bold gradient-text">Upload Slides</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Upload your study materials and we&apos;ll generate questions automatically.
          </p>
        </div>
      </motion.div>

      {/* Course Category & Title */}
      <motion.div variants={fadeUp} className="space-y-4">
        {/* Category chips with icons and checkmark overlay */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Course Category</Label>
          <TooltipProvider delayDuration={300}>
            {/* Uniform grid: chips share one width per row and wrap evenly */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {COURSE_CATEGORIES.map((cat, idx) => {
                const config = CATEGORY_CONFIG[cat];
                const CatIcon = config?.icon || FolderOpen;
                const isActive = selectedCategory === cat && !showCustomCategory;
                return (
                  <Tooltip key={cat}>
                    <TooltipTrigger asChild>
                      <motion.button
                        initial={{ opacity: 0, scale: 0.8, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ delay: 0.04 * idx, type: 'spring', stiffness: 400, damping: 25 }}
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.92 }}
                        onClick={() => {
                          if (showCustomCategory) setShowCustomCategory(false);
                          setSelectedCategory(cat);
                        }}
                        className={`category-chip w-full justify-center ${config?.chipClass || 'category-chip-other'} ${isActive ? 'active' : ''}`}
                      >
                        <CatIcon className="h-3.5 w-3.5" />
                        <span>{cat}</span>
                        <AnimatePresence>
                          {isActive && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              exit={{ scale: 0 }}
                              transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      {cat}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
              <motion.button
                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: 0.04 * COURSE_CATEGORIES.length, type: 'spring', stiffness: 400, damping: 25 }}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => {
                  setShowCustomCategory(true);
                  setSelectedCategory('');
                }}
                className={`category-chip w-full justify-center ${showCustomCategory
                  ? 'active bg-linear-to-r from-primary/15 to-secondary/15 text-primary border-primary/20'
                  : 'bg-background/60 border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                <Plus className="h-3.5 w-3.5" />
                Custom...
              </motion.button>
            </div>
          </TooltipProvider>
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
                  autoFocus
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="space-y-2">
          {/* Floating label: sits as the placeholder, lifts when focused/filled */}
          <div className="relative">
            <Input
              id="course-title"
              placeholder=" "
              value={courseTitle}
              onChange={(e) => setCourseTitle(e.target.value)}
              onBlur={() => setTitleTouched(true)}
              className={`peer h-12 pt-4 ${
                titleError
                  ? 'border-destructive focus-visible:ring-destructive/50'
                  : courseTitle.trim()
                    ? 'border-primary/50 text-foreground font-medium focus-visible:ring-primary/50 focus-visible:border-primary'
                    : ''
              }`}
            />
            <Label
              htmlFor="course-title"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none transition-all duration-150 peer-focus:top-3 peer-focus:translate-y-0 peer-focus:text-[10px] peer-focus:text-primary peer-not-placeholder-shown:top-3 peer-not-placeholder-shown:translate-y-0 peer-not-placeholder-shown:text-[10px]"
            >
              Course Title <span className="text-destructive">*</span>
            </Label>
          </div>
            <AnimatePresence>
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
          className={`relative cursor-pointer rounded-xl border-2 border-dashed p-12 text-center transition-all overflow-hidden glass upload-glass-focus upload-drag-animated min-h-70 flex items-center justify-center ${
            isDragOver
              ? 'dragging border-primary bg-primary/5 scale-[1.01] pulse-glow gradient-border'
              : 'border-border/60 hover:border-primary/40'
          }`}
        >
          <FloatingParticles />
          <div className="dropzone-particles" />
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPTED_EXTENSIONS.join(',')}
            className="hidden"
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />
          <div className="relative z-10 flex flex-col items-center gap-3">
            <motion.div
              className={`h-16 w-16 rounded-2xl flex items-center justify-center transition-colors ${isDragOver ? 'bg-primary/20 glow-emerald-strong' : 'bg-primary/10'}`}
              animate={isDragOver ? { y: [0, -6, 0], rotate: [0, 5, -5, 0] } : { y: [0, -3, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Upload className={`h-8 w-8 transition-colors float-gentle ${isDragOver ? 'text-primary' : 'text-primary/60'}`} />
            </motion.div>
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

      {/* Batch Upload Progress Panel */}
      <AnimatePresence>
        {isUploading && files.length > 1 && (
          <BatchProgressPanel files={files} onCancel={cancelUpload} />
        )}
      </AnimatePresence>

      {/* File List */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            // Fade only when there's actually something to scroll to — the
            // mask was washing out a lone uploaded file card
            className={`space-y-2 max-h-96 overflow-y-auto ${files.length > 4 ? 'scroll-fade-bottom' : ''}`}
          >
            {files.map((f, idx) => {
              const ext = getFileExt(f.file.name);
              const typeConfig = FILE_TYPE_CONFIG[ext];
              return (
                <motion.div
                  key={f.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: idx * 0.08, type: 'spring', stiffness: 400, damping: 22 }}
                  className={`glass-hover rounded-lg p-3 flex items-center gap-3 ${f.status === 'done' ? 'glow-emerald' : ''}`}
                >
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${typeConfig?.bg || 'bg-muted'}`}>
                    {statusIcon(f.status, f.file.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{f.file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(f.file.size)}
                      {f.status === 'error' && f.error && ` — ${f.error}`}
                    </p>
                    {(f.status === 'uploading' || f.status === 'processing') && (
                      <div className="mt-2 relative h-1.5 w-full rounded-full bg-muted/50 overflow-hidden">
                        <motion.div
                          className="absolute inset-y-0 left-0 rounded-full overflow-hidden"
                          style={{ background: 'linear-gradient(90deg, oklch(0.627 0.194 149.214), oklch(0.687 0.159 177.89))' }}
                          animate={{ width: `${f.status === 'processing' ? 100 : f.progress}%` }}
                          transition={{ duration: 0.3 }}
                        >
                          {/* Shimmer on progress bar */}
                          <motion.div
                            className="absolute inset-0 -translate-x-full"
                            animate={{ translateX: ['-100%', '100%', '200%'] }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                            style={{
                              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)',
                            }}
                          />
                        </motion.div>
                      </div>
                    )}
                  {f.status === 'done' && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-xs text-emerald-600 dark:text-emerald-400 font-medium"
                    >
                      Done
                    </motion.span>
                  )}
                </div>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(f.id);
                    }}
                    className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-destructive/10 transition-colors"
                    aria-label={`Remove ${f.file.name}`}
                  >
                    <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </motion.button>
              </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action Buttons */}
      {files.length > 0 && !generatedCount && (
        <motion.div variants={fadeUp} className="flex flex-wrap gap-3">
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="w-full sm:w-auto [&_button]:w-full sm:[&_button]:w-auto">
            <Button
              onClick={simulateUpload}
              disabled={files.every((f) => f.status === 'done') || files.every((f) => f.status === 'uploading' || f.status === 'processing') || isUploading}
              className="glow-emerald glow-pulse transition-shadow duration-300"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Files
            </Button>
          </motion.div>
          {(extractedSlides.length > 0 || files.some((f) => f.status === 'done')) && (
            <>
              {/* ONE generate button: uses your slide selection when you've
                  narrowed it, otherwise covers everything */}
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="w-full sm:w-auto [&_button]:w-full sm:[&_button]:w-auto">
                <Button
                  onClick={() => simulateGenerate(
                    extractedSlides.length > 0 &&
                    selectedSlideIds.size > 0 &&
                    selectedSlideIds.size < extractedSlides.length
                  )}
                  disabled={!files.some((f) => f.status === 'done') || isGenerating}
                  variant="outline"
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  {extractedSlides.length > 0 && selectedSlideIds.size > 0 && selectedSlideIds.size < extractedSlides.length
                    ? `Generate Questions (${selectedSlideIds.size} slides)`
                    : 'Generate Questions'}
                </Button>
              </motion.div>
              {/* Jump straight in — no need to generate first */}
              {files.some((f) => f.status === 'done') && (
                <>
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="w-full sm:w-auto [&_button]:w-full sm:[&_button]:w-auto">
                    <Button
                      onClick={() => {
                        setActiveSession(`session-${Date.now()}`, activeCourse?.id, activeCourse?.title ?? 'Study Session');
                        navigate('tutor');
                      }}
                      className="glow-emerald transition-shadow duration-300"
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Start Tutor
                    </Button>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="w-full sm:w-auto [&_button]:w-full sm:[&_button]:w-auto">
                    <Button variant="outline" onClick={() => navigate('quiz')}>
                      <ClipboardCheck className="h-4 w-4 mr-2" />
                      Take Quiz
                    </Button>
                  </motion.div>
                </>
              )}
            </>
          )}
        </motion.div>
      )}

      {/* Slide Grouping Preview */}
      <AnimatePresence>
        {extractedSlides.length > 0 && !generatedCount && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className="glass rounded-xl overflow-hidden gradient-border glow-emerald"
            layout
          >
            <Collapsible open={slidesOpen} onOpenChange={setSlidesOpen}>
              <div className="flex items-center justify-between w-full p-4 hover:bg-accent/30 transition-colors">
                <CollapsibleTrigger asChild>
                  <button type="button" className="flex items-center gap-2 flex-1 text-left">
                    <motion.div
                      animate={{ rotate: slidesOpen ? 0 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      {slidesOpen ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </motion.div>
                    <span className="font-medium text-sm">
                      Extracted Slides ({extractedSlides.length})
                    </span>
                  </button>
                </CollapsibleTrigger>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {selectedSlideIds.size}/{extractedSlides.length} selected
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => toggleAllSlides()}
                  >
                    {selectedSlideIds.size === extractedSlides.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
              </div>
              <AnimatePresence initial={false}>
                <CollapsibleContent forceMount>
                  <motion.div
                    initial={false}
                    animate={{ height: slidesOpen ? 'auto' : 0, opacity: slidesOpen ? 1 : 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                    className="overflow-hidden"
                  >
                    <div className="max-h-96 overflow-y-auto scroll-fade-bottom border-t">
                      {extractedSlides.map((slide) => {
                        const isSelected = selectedSlideIds.has(slide.id);
                        const previewTitle = slide.title.length > 50 ? slide.title.slice(0, 50) + '...' : slide.title;
                        return (
                          <motion.div
                            key={slide.id}
                            layout
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
                            <div className="flex items-center justify-center h-6 w-6 rounded-md bg-muted text-muted-foreground text-xs font-mono shrink-0">
                              {slide.order}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{previewTitle}</p>
                              <p className="text-xs text-muted-foreground">
                                {slide.wordCount} words
                              </p>
                            </div>
                            <Hash className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                </CollapsibleContent>
              </AnimatePresence>
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
            className="glass rounded-xl p-6 text-center space-y-4 card-shadow gradient-border gradient-border-static"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-500/15 to-teal-500/15 mx-auto pulse-glow">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-xl font-bold gradient-text">Questions Generated!</h3>
              <p className="text-muted-foreground text-sm mt-1">
                {generatedCount} questions ready from {files.filter((f) => f.status === 'done').length} file(s)
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="w-full sm:w-auto [&_button]:w-full sm:[&_button]:w-auto">
                <Button
                  onClick={() => {
                    setActiveSession(`session-${Date.now()}`, activeCourse?.id, activeCourse?.title ?? 'Study Session');
                    navigate('tutor');
                  }}
                  className="glow-emerald transition-shadow duration-300"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Start Tutor
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="w-full sm:w-auto [&_button]:w-full sm:[&_button]:w-auto">
                <Button
                  variant="outline"
                  onClick={() => {
                    setQuizScore(0, generatedCount);
                    navigate('quiz');
                  }}
                >
                  <ClipboardCheck className="h-4 w-4 mr-2" />
                  Take Quiz
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="w-full sm:w-auto [&_button]:w-full sm:[&_button]:w-auto">
                <Button
                  variant="outline"
                  onClick={() => navigate('course-detail')}
                >
                  <BookOpen className="h-4 w-4 mr-2" />
                  View Course
                </Button>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload History */}
      <UploadHistoryPanel history={uploadHistory} onReupload={handleReupload} />

      {/* Quick Tips Section */}
      {files.length === 0 && generatedCount === null && uploadHistory.length === 0 && <QuickTips />}
    </motion.div>
  );
}