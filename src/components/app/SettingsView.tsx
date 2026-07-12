'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import {
  Palette,
  Bot,
  BookOpen,
  Bell,
  Database,
  Info,
  Download,
  Trash2,
  Moon,
  Sun,
  Monitor,
  LayoutGrid,
  AlertTriangle,
  Smartphone,
  Copy,
  ClipboardPaste,
  Check,
  X,
  KeyRound,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useAppStore } from '@/stores/appStore';
import { useTheme } from 'next-themes';
import { exportProfileCode, importProfileCode, resetAllData } from '@/lib/transfer';
import { getOpenRouterKey, setOpenRouterKey } from '@/lib/aiKey';
import { getByoStorage, setByoStorage } from '@/lib/byoStorage';
import { KOKORO_VOICES, getSelectedVoice, setSelectedVoice, isVoiceDownloaded, downloadVoices, speak, getCustomVoice, saveCustomVoiceBlend, deleteCustomVoice } from '@/lib/voice/tts';
import { Volume2 } from 'lucide-react';

/** Personas must match the tutor's PersonaSelector so the default applies. */
const PERSONA_OPTIONS = [
  { id: 'professor', label: 'Professor', quote: '"Let us examine the underlying principles..."' },
  { id: 'coach', label: 'Coach', quote: '"You\'re doing amazing! Let\'s push further!"' },
  { id: 'storyteller', label: 'Storyteller', quote: '"Picture this: once upon a time..."' },
  { id: 'friend', label: 'Friend', quote: '"Ok so basically, here\'s the deal..."' },
];

const stagger: Variants = {
  animate: { transition: { staggerChildren: 0.07 } },
};
const fadeUp: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

function SectionCard({
  icon: Icon,
  title,
  children,
  isDanger = false,
}: {
  icon: typeof Palette;
  title: string;
  gradientFrom?: string;
  gradientTo?: string;
  children: React.ReactNode;
  index?: number;
  isDanger?: boolean;
}) {
  return (
    <motion.div variants={fadeUp} className="glass rounded-xl overflow-hidden border border-border/60">
      <div className="px-5 py-3 flex items-center gap-2.5 border-b border-border/40">
        <div className={`flex h-6 w-6 items-center justify-center rounded-md ${isDanger ? 'bg-red-500/10' : 'bg-muted'}`}>
          <Icon className={`h-3.5 w-3.5 ${isDanger ? 'text-red-500' : 'text-muted-foreground'}`} />
        </div>
        <h3 className={`text-sm lg:text-base font-semibold ${isDanger ? 'text-red-600 dark:text-red-400' : ''}`}>{title}</h3>
      </div>
      <div className="p-5 space-y-4">
        {children}
      </div>
    </motion.div>
  );
}

function SettingRow({
  label,
  description,
  children,
  stackOnMobile = false,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
  /** Wide controls (button groups): on phones the text takes its own full
      row and the controls drop underneath instead of squeezing beside it (D1). */
  stackOnMobile?: boolean;
}) {
  return (
    <div className={`group ${stackOnMobile ? 'flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4' : 'flex items-center justify-between gap-4'}`}>
      <div className="min-w-0">
        <p className="text-sm lg:text-[15px] font-medium group-hover:text-foreground transition-colors">{label}</p>
        {description && (
          <p className="text-xs lg:text-sm text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function AnimatedSwitch({ checked, onCheckedChange, ariaLabel }: { checked: boolean; onCheckedChange: (checked: boolean) => void; ariaLabel: string }) {
  return (
    <motion.div whileTap={{ scale: 0.9 }} className="relative">
      <AnimatePresence mode="wait">
        <motion.div
          key={checked ? 'on' : 'off'}
          initial={{ scale: 0.9, opacity: 0.5 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0.5 }}
          transition={{ duration: 0.15 }}
        >
          <Switch
            checked={checked}
            onCheckedChange={onCheckedChange}
            aria-label={ariaLabel}
          />
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

function SelectWithGlow({ value, onValueChange, children }: { value: string; onValueChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.15 }}>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="w-40 transition-shadow duration-300 hover:glow-emerald">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {children}
        </SelectContent>
      </Select>
    </motion.div>
  );
}

function ExportButton({ onClick, children, icon }: { onClick: () => void; children: React.ReactNode; icon: React.ReactNode }) {
  const [isAnimating, setIsAnimating] = useState(false);

  const handleClick = () => {
    setIsAnimating(true);
    onClick();
    setTimeout(() => setIsAnimating(false), 600);
  };

  return (
    <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        className="hover:glow-emerald transition-shadow duration-300"
      >
        <motion.span
          animate={isAnimating ? { y: [0, -6, 0] } : {}}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="mr-2 inline-flex"
        >
          {icon}
        </motion.span>
        {children}
      </Button>
    </motion.div>
  );
}

/**
 * Voice manager (task 71): Kokoro voice download lives here — progress bar,
 * ready state, voice picker, quick preview. Once downloaded the model warms
 * on app entry, so read-aloud starts instantly everywhere.
 */
function VoiceSettings() {
  const [downloaded, setDownloaded] = useState(() => isVoiceDownloaded());
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [voice, setVoice] = useState(() => getSelectedVoice());
  const [previewing, setPreviewing] = useState(false);

  // Voice Lab (custom voice via style-vector blending)
  const [customVoice, setCustomVoice] = useState(() => getCustomVoice());
  const [blendA, setBlendA] = useState(() => getCustomVoice()?.voiceA ?? 'af_heart');
  const [blendB, setBlendB] = useState(() => getCustomVoice()?.voiceB ?? 'bm_george');
  const [blendRatio, setBlendRatio] = useState(() => getCustomVoice()?.ratio ?? 0.5);
  const [blendName, setBlendName] = useState(() => getCustomVoice()?.name ?? 'My Voice');
  const [savingBlend, setSavingBlend] = useState(false);

  const handleSaveBlend = async () => {
    setSavingBlend(true);
    const ok = await saveCustomVoiceBlend({ name: blendName.trim(), voiceA: blendA, voiceB: blendB, ratio: blendRatio });
    setSavingBlend(false);
    if (ok) {
      setCustomVoice(getCustomVoice());
      setSelectedVoice('custom');
      setVoice('custom');
      toast.success(`Voice "${blendName.trim()}" created — refresh the page for it to fully apply`);
    } else {
      toast.error('Could not create the voice — check your connection and try again');
    }
  };

  const handleDeleteBlend = async () => {
    await deleteCustomVoice();
    setCustomVoice(null);
    if (voice === 'custom') {
      setSelectedVoice('af_heart');
      setVoice('af_heart');
    }
    toast('Custom voice deleted');
  };

  const handleDownload = async () => {
    setDownloading(true);
    setProgress(0);
    const ok = await downloadVoices((pct) => setProgress(pct));
    setDownloading(false);
    if (ok) {
      setDownloaded(true);
      toast.success('Voices downloaded — text-to-speech now starts instantly');
    } else {
      toast.error('Voice download failed — the browser voice will be used instead');
    }
  };

  const handleVoiceChange = (id: string) => {
    setVoice(id);
    setSelectedVoice(id);
  };

  const handlePreview = async () => {
    setPreviewing(true);
    await speak('Hi! This is how I sound when I read your slides.', {
      voice,
      onEnd: () => setPreviewing(false),
    });
  };

  return (
    <>
      <SettingRow
        label="Natural voice (Kokoro)"
        description={
          downloaded
            ? 'Downloaded — speech starts instantly, everything stays on this device'
            : 'One-time ~80 MB download; runs fully in your browser'
        }
        stackOnMobile
      >
        {downloaded ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <Check className="h-3.5 w-3.5" /> Ready
          </span>
        ) : (
          <Button size="sm" onClick={handleDownload} disabled={downloading}>
            {downloading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {progress > 0 ? `${progress}%` : 'Downloading…'}
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" /> Download voices
              </>
            )}
          </Button>
        )}
      </SettingRow>
      {downloading && (
        <div className="relative h-1.5 w-full rounded-full bg-muted/50 overflow-hidden">
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full bg-primary"
            animate={{ width: `${Math.max(progress, 4)}%` }}
            transition={{ duration: 0.2 }}
          />
        </div>
      )}
      <Separator className="opacity-50" />
      <SettingRow label="Voice" description="Used when reading slides, voice mode, and answers aloud">
        <div className="flex items-center gap-2">
          <SelectWithGlow value={voice} onValueChange={handleVoiceChange}>
            {KOKORO_VOICES.map((v) => (
              <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>
            ))}
            {customVoice && <SelectItem value="custom">★ {customVoice.name} (custom)</SelectItem>}
          </SelectWithGlow>
          <Button variant="outline" size="sm" onClick={handlePreview} disabled={previewing} aria-label="Preview voice">
            {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
          </Button>
        </div>
      </SettingRow>
      <Separator className="opacity-50" />

      {/* Voice Lab: design a custom voice by blending two built-in style
          vectors — the practical "voice cloning" for a fully-local stack */}
      <SettingRow
        label="Voice Lab — create your own voice"
        description="Blend two voices into a new one. It runs 100% locally, like everything else here."
        stackOnMobile
      >
        <div className="flex flex-col gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <SelectWithGlow value={blendA} onValueChange={setBlendA}>
              {KOKORO_VOICES.map((v) => (
                <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>
              ))}
            </SelectWithGlow>
            <span className="text-xs text-muted-foreground">+</span>
            <SelectWithGlow value={blendB} onValueChange={setBlendB}>
              {KOKORO_VOICES.map((v) => (
                <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>
              ))}
            </SelectWithGlow>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(blendRatio * 100)}
              onChange={(e) => setBlendRatio(Number(e.target.value) / 100)}
              aria-label="Blend ratio"
              className="flex-1 accent-emerald-500"
            />
            <span className="w-14 text-right text-xs tabular-nums text-muted-foreground">{Math.round(blendRatio * 100)}%A</span>
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={blendName}
              onChange={(e) => setBlendName(e.target.value)}
              placeholder="Voice name"
              className="h-8 text-xs flex-1"
            />
            <Button size="sm" onClick={handleSaveBlend} disabled={savingBlend || !blendName.trim()}>
              {savingBlend ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
            </Button>
            {customVoice && (
              <Button size="sm" variant="outline" onClick={handleDeleteBlend} aria-label="Delete custom voice">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          {customVoice && (
            <p className="text-[11px] text-muted-foreground">
              Current: <span className="font-medium">★ {customVoice.name}</span> ({Math.round(customVoice.ratio * 100)}% {KOKORO_VOICES.find((v) => v.id === customVoice.voiceA)?.label} + {100 - Math.round(customVoice.ratio * 100)}% {KOKORO_VOICES.find((v) => v.id === customVoice.voiceB)?.label}). A new blend applies fully after a page refresh.
            </p>
          )}
        </div>
      </SettingRow>
      <Separator className="opacity-50" />
      <SettingRow
        label="Clone from a recording"
        description="True sample-based cloning needs a heavier model (e.g. OpenVoice/F5-TTS) than a browser can run — the Voice Lab blend above is the local-first equivalent"
      >
        <span className="text-xs text-muted-foreground rounded-full border border-border/60 px-2.5 py-1">Not in-browser yet</span>
      </SettingRow>
    </>
  );
}

export function SettingsView() {
  const { settings, updateSettings, notes, studySessions, masteryMap, achievements, adaptiveResults, quizScore, quizTotal } = useAppStore();
  const { setTheme, theme } = useTheme();
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [transferCode, setTransferCode] = useState('');
  const [importCode, setImportCode] = useState('');
  const [copied, setCopied] = useState(false);
  // The learner's own OpenRouter key — browser-only, never in our DB
  const [orKey, setOrKey] = useState(() => getOpenRouterKey());
  const [orKeySaved, setOrKeySaved] = useState(() => !!getOpenRouterKey());
  const handleSaveOrKey = () => {
    const trimmed = orKey.trim();
    if (trimmed && !/^sk-or-/.test(trimmed)) {
      toast.error('That does not look like an OpenRouter key — it should start with "sk-or-".');
      return;
    }
    setOpenRouterKey(trimmed);
    setOrKeySaved(!!trimmed);
    toast.success(trimmed ? 'API key saved to this browser' : 'API key removed');
  };
  // Bring-your-own storage (Cloudinary + database) — browser-only, like the key
  const [byo, setByo] = useState(() => getByoStorage());
  const handleSaveByo = () => {
    setByoStorage(byo);
    toast.success('Storage settings saved to this browser');
  };

  // Cloud sync actions (Phase 3): push browser → learner's own DB, pull back,
  // and optional local wipe once migrated
  const [syncBusy, setSyncBusy] = useState<false | 'push' | 'pull' | 'clear'>(false);
  const handleMigrateToCloud = async () => {
    setSyncBusy('push');
    try {
      const { migrateBrowserToCloud } = await import('@/lib/byoSync');
      const res = await migrateBrowserToCloud();
      toast.success(`Migrated ${res.courses} course(s), ${res.slides} slide(s) and ${res.kvEntries} data entries to your database`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Migration failed — check your database URL and token');
    } finally {
      setSyncBusy(false);
    }
  };
  const handlePullFromCloud = async () => {
    setSyncBusy('pull');
    try {
      const { pullCloudToBrowser } = await import('@/lib/byoSync');
      const pulled = await pullCloudToBrowser();
      toast.success(pulled > 0 ? `Pulled ${pulled} course(s) from your database — reload to see them` : 'Your database has no courses yet');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Pull failed — check your database URL and token');
    } finally {
      setSyncBusy(false);
    }
  };
  const handleClearBrowser = async () => {
    if (!window.confirm('Clear ALL SynapseLearn data from this browser (courses, progress, chats, caches)? Your API key and storage credentials are kept. Make sure you migrated to your cloud first.')) return;
    setSyncBusy('clear');
    try {
      const { clearBrowserData } = await import('@/lib/byoSync');
      await clearBrowserData({ keepCredentials: true });
      toast.success('Browser data cleared — reloading');
      setTimeout(() => window.location.reload(), 1200);
    } catch {
      toast.error('Could not fully clear browser data');
      setSyncBusy(false);
    }
  };

  // Compact mode: apply/remove a root class the stylesheet reacts to
  useEffect(() => {
    document.documentElement.classList.toggle('compact', settings.compactMode);
  }, [settings.compactMode]);

  // Migrate persona ids from older builds to the tutor's real persona set
  useEffect(() => {
    if (!PERSONA_OPTIONS.some((p) => p.id === settings.defaultPersona)) {
      const migrations: Record<string, string> = { socratic: 'professor', encyclopedic: 'professor', friendly: 'friend' };
      updateSettings({ defaultPersona: migrations[settings.defaultPersona] ?? 'storyteller' });
    }
  }, [settings.defaultPersona, updateSettings]);

  const handleThemeChange = (value: string) => {
    setTheme(value);
    updateSettings({ theme: value as 'light' | 'dark' | 'system' });
  };

  const handleGenerateTransferCode = () => {
    try {
      const code = exportProfileCode();
      setTransferCode(code);
      toast.success('Transfer code generated — copy it to your new device');
    } catch {
      toast.error('Failed to generate transfer code');
    }
  };

  const handleCopyTransferCode = async () => {
    try {
      await navigator.clipboard.writeText(transferCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Copy failed — select and copy the text manually');
    }
  };

  const handleDownloadTransferCode = () => {
    try {
      const blob = new Blob([transferCode], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'synapselearn-profile.txt';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed');
    }
  };

  const handleImportProfile = () => {
    try {
      const count = importProfileCode(importCode);
      toast.success(`Profile restored (${count} items) — reloading...`);
      setTimeout(() => window.location.reload(), 900);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed');
    }
  };

  const handleExportNotes = () => {
    try {
      const data = JSON.stringify(notes, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'synapselearn-notes.json';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Notes exported successfully');
    } catch {
      toast.error('Failed to export notes');
    }
  };

  const handleExportHistory = () => {
    try {
      const data = JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          studySessions,
          masteryMap,
          lastQuiz: quizScore !== null && quizTotal !== null ? { score: quizScore, total: quizTotal } : null,
          adaptiveResults,
          achievements: achievements.filter((a) => a.unlockedAt),
        },
        null,
        2
      );
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'synapselearn-session-history.json';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Session history exported');
    } catch {
      toast.error('Failed to export session history');
    }
  };

  const handleClearAllData = () => {
    try {
      resetAllData();
      window.location.reload();
    } catch {
      toast.error('Failed to clear data');
    }
  };

  const currentTheme = theme ?? 'system';

  return (
    <motion.div
      variants={stagger}
      initial="initial"
      animate="animate"
      className="space-y-6 pt-2 lg:pt-4 max-w-4xl mx-auto"
    >
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl lg:text-3xl font-bold gradient-text">Settings</h1>
        <p className="text-sm lg:text-base text-muted-foreground mt-1">
          Manage your preferences and application settings
        </p>
      </motion.div>

      <Separator />

      {/* Appearance */}
      <SectionCard
        icon={Palette}
        title="Appearance"
        gradientFrom="from-violet-600"
        gradientTo="to-purple-600"
        index={0}
      >
        <SettingRow label="Theme" description="Choose your preferred color scheme" stackOnMobile>
          <div className="flex gap-1">
            {[
              { value: 'light', icon: Sun, label: 'Light' },
              { value: 'dark', icon: Moon, label: 'Dark' },
              { value: 'system', icon: Monitor, label: 'System' },
            ].map((opt) => {
              const isActive = currentTheme === opt.value;
              return (
                <motion.button
                  key={opt.value}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleThemeChange(opt.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    isActive
                      ? 'border-primary bg-primary/10 text-primary glow-emerald'
                      : 'border-border hover:bg-accent text-muted-foreground hover:text-accent-foreground'
                  }`}
                >
                  <opt.icon className="h-3.5 w-3.5" />
                  {opt.label}
                </motion.button>
              );
            })}
          </div>
        </SettingRow>
        <Separator className="opacity-50" />
        <SettingRow label="Compact Mode" description="Reduce spacing for more content density">
          <AnimatedSwitch
            checked={settings.compactMode}
            onCheckedChange={(checked) => updateSettings({ compactMode: checked })}
            ariaLabel="Compact Mode"
          />
        </SettingRow>
      </SectionCard>

      {/* Voice & Speech (task 71) */}
      <SectionCard icon={Volume2} title="Voice & Speech" index={1}>
        <VoiceSettings />
      </SectionCard>

      {/* AI Preferences */}
      <SectionCard
        icon={Bot}
        title="AI Preferences"
        gradientFrom="from-emerald-600"
        gradientTo="to-teal-600"
        index={1}
      >
        <SettingRow label="Default Persona" description="AI tutor personality">
          <SelectWithGlow
            value={settings.defaultPersona}
            onValueChange={(val) => updateSettings({ defaultPersona: val })}
          >
            {PERSONA_OPTIONS.map((p) => (
              <SelectItem key={p.id} value={p.id} textValue={p.label}>
                <div className="flex flex-col items-start gap-0.5 py-0.5">
                  <span className="font-medium">{p.label}</span>
                  <span className="text-[11px] text-muted-foreground italic">{p.quote}</span>
                </div>
              </SelectItem>
            ))}
          </SelectWithGlow>
        </SettingRow>
        <Separator className="opacity-50" />
        <SettingRow label="Response Speed" description="How verbose AI responses should be">
          <SelectWithGlow
            value={settings.responseSpeed}
            onValueChange={(val) => updateSettings({ responseSpeed: val as 'concise' | 'balanced' | 'detailed' })}
          >
            <SelectItem value="concise">Concise</SelectItem>
            <SelectItem value="balanced">Balanced</SelectItem>
            <SelectItem value="detailed">Detailed</SelectItem>
          </SelectWithGlow>
        </SettingRow>
        <Separator className="opacity-50" />
        <SettingRow label="Language" description="Preferred interaction language">
          <SelectWithGlow
            value={settings.language}
            onValueChange={(val) => updateSettings({ language: val })}
          >
            <SelectItem value="English">English</SelectItem>
            <SelectItem value="Spanish">Spanish</SelectItem>
            <SelectItem value="French">French</SelectItem>
            <SelectItem value="German">German</SelectItem>
            <SelectItem value="Chinese">Chinese</SelectItem>
            <SelectItem value="Japanese">Japanese</SelectItem>
          </SelectWithGlow>
        </SettingRow>
      </SectionCard>

      {/* AI Access — the learner's own OpenRouter key */}
      <SectionCard icon={KeyRound} title="AI Access">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">OpenRouter API Key</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              All AI features run on your own free OpenRouter account. Your key is stored only in
              this browser — never on our servers. Get a free key at{' '}
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2"
              >
                openrouter.ai/keys
              </a>
              .
            </p>
          </div>
          <div className="flex gap-2">
            <Input
              type="password"
              value={orKey}
              onChange={(e) => setOrKey(e.target.value)}
              placeholder="sk-or-v1-..."
              autoComplete="off"
              className="font-mono text-xs"
              aria-label="OpenRouter API key"
            />
            <Button size="sm" onClick={handleSaveOrKey} className="shrink-0">
              {orKeySaved ? 'Update' : 'Save'}
            </Button>
          </div>
          {orKeySaved ? (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <Check className="h-3 w-3" /> Key active on this device
            </p>
          ) : (
            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> No key yet — AI tutor, quizzes, and study plans
              will not work until you add one
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            If AI replies stop with a rate-limit message, your key has hit its free limit — wait
            for it to reset or paste a different key.
          </p>
        </div>
      </SectionCard>

      {/* Your Storage — bring-your-own database + Cloudinary (Phase 3) */}
      <SectionCard icon={Database} title="Your Storage">
        <div className="space-y-3">
          <p className="text-xs lg:text-sm text-muted-foreground">
            Own your data completely: connect your own database and Cloudinary account, and your
            courses, slides and progress sync to infrastructure only you control. Keys are stored
            in this browser only. Cross-device sync using these keys arrives in an upcoming
            update — saving them now means you are ready the moment it ships.
          </p>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="byo-db-url">Database URL</label>
            <Input
              id="byo-db-url"
              type="text"
              value={byo.dbUrl}
              onChange={(e) => setByo((p) => ({ ...p, dbUrl: e.target.value }))}
              placeholder="libsql://your-db.turso.io"
              autoComplete="off"
              className="font-mono text-xs"
            />
            <label className="text-sm font-medium" htmlFor="byo-db-token">Database auth token (if your DB uses one)</label>
            <Input
              id="byo-db-token"
              type="password"
              value={byo.dbAuthToken}
              onChange={(e) => setByo((p) => ({ ...p, dbAuthToken: e.target.value }))}
              placeholder="ey..."
              autoComplete="off"
              className="font-mono text-xs"
            />
            <label className="text-sm font-medium" htmlFor="byo-cloudinary">Cloudinary URL (for your slide files)</label>
            <Input
              id="byo-cloudinary"
              type="password"
              value={byo.cloudinaryUrl}
              onChange={(e) => setByo((p) => ({ ...p, cloudinaryUrl: e.target.value }))}
              placeholder="cloudinary://..."
              autoComplete="off"
              className="font-mono text-xs"
            />
          </div>
          <Button size="sm" onClick={handleSaveByo}>Save storage settings</Button>

          {/* Sync actions — only meaningful once a database is connected */}
          {byo.dbUrl && byo.dbAuthToken && (
            <div className="space-y-2 pt-2 border-t border-border/60">
              <p className="text-xs text-muted-foreground">
                Your database is connected. Migrate what&apos;s in this browser to your cloud, pull
                your cloud data into a new device, or wipe this browser once migrated.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={syncBusy !== false} onClick={handleMigrateToCloud}>
                  {syncBusy === 'push' ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Database className="h-3.5 w-3.5 mr-1.5" />}
                  Migrate browser → my cloud
                </Button>
                <Button size="sm" variant="outline" disabled={syncBusy !== false} onClick={handlePullFromCloud}>
                  {syncBusy === 'pull' ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Database className="h-3.5 w-3.5 mr-1.5" />}
                  Pull my cloud → browser
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={syncBusy !== false}
                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={handleClearBrowser}
                >
                  Clear browser data
                </Button>
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Study Settings */}
      <SectionCard
        icon={BookOpen}
        title="Study Settings"
        gradientFrom="from-amber-600"
        gradientTo="to-orange-600"
        index={2}
      >
        <SettingRow label="Default Session Duration" description="Minutes per study session">
          <SelectWithGlow
            value={String(settings.defaultSessionDuration)}
            onValueChange={(val) => updateSettings({ defaultSessionDuration: parseInt(val, 10) })}
          >
            <SelectItem value="15">15 minutes</SelectItem>
            <SelectItem value="25">25 minutes</SelectItem>
            <SelectItem value="30">30 minutes</SelectItem>
            <SelectItem value="45">45 minutes</SelectItem>
            <SelectItem value="60">60 minutes</SelectItem>
            <SelectItem value="90">90 minutes</SelectItem>
          </SelectWithGlow>
        </SettingRow>
        <Separator className="opacity-50" />
        <SettingRow label="Resume Previous Chat" description="Continue a course's tutor conversation from where you stopped instead of starting fresh">
          <AnimatedSwitch
            checked={settings.keepChatHistory}
            onCheckedChange={(checked) => updateSettings({ keepChatHistory: checked })}
            ariaLabel="Resume Previous Chat"
          />
        </SettingRow>
        <Separator className="opacity-50" />
        <SettingRow label="Auto-Break Reminders" description="Get notified to take breaks during long sessions">
          <AnimatedSwitch
            checked={settings.autoBreakReminders}
            onCheckedChange={(checked) => updateSettings({ autoBreakReminders: checked })}
            ariaLabel="Auto-Break Reminders"
          />
        </SettingRow>
        <Separator className="opacity-50" />
        <SettingRow label="Daily Goal (Hours)" description="Target study hours per day">
          <SelectWithGlow
            value={String(settings.dailyGoalHours)}
            onValueChange={(val) => updateSettings({ dailyGoalHours: parseInt(val, 10) })}
          >
            <SelectItem value="1">1 hour</SelectItem>
            <SelectItem value="2">2 hours</SelectItem>
            <SelectItem value="3">3 hours</SelectItem>
            <SelectItem value="4">4 hours</SelectItem>
            <SelectItem value="5">5 hours</SelectItem>
            <SelectItem value="6">6 hours</SelectItem>
          </SelectWithGlow>
        </SettingRow>
      </SectionCard>

      {/* Notifications */}
      <SectionCard
        icon={Bell}
        title="Notifications"
        gradientFrom="from-rose-600"
        gradientTo="to-pink-600"
        index={3}
      >
        <SettingRow label="Session Reminders" description="Get reminders to start studying">
          <AnimatedSwitch
            checked={settings.sessionReminders}
            onCheckedChange={(checked) => updateSettings({ sessionReminders: checked })}
            ariaLabel="Session Reminders"
          />
        </SettingRow>
        <Separator className="opacity-50" />
        <SettingRow label="Streak Alerts" description="Alerts when your study streak is at risk">
          <AnimatedSwitch
            checked={settings.streakAlerts}
            onCheckedChange={(checked) => updateSettings({ streakAlerts: checked })}
            ariaLabel="Streak Alerts"
          />
        </SettingRow>
      </SectionCard>

      {/* Data */}
      <SectionCard
        icon={Database}
        title="Data Management"
        gradientFrom="from-cyan-600"
        gradientTo="to-sky-600"
        index={4}
      >
        <div className="flex flex-wrap gap-2">
          <ExportButton onClick={handleExportNotes} icon={<Download className="h-4 w-4" />}>
            Export Notes
          </ExportButton>
          <ExportButton onClick={handleExportHistory} icon={<Download className="h-4 w-4" />}>
            Export Session History
          </ExportButton>
        </div>
      </SectionCard>

      {/* Switch Device */}
      <SectionCard
        icon={Smartphone}
        title="Switch Device"
        gradientFrom="from-indigo-600"
        gradientTo="to-blue-600"
        index={5}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Your entire profile lives in this browser — nothing is stored on our servers.
            Generate a transfer code here and paste it on your new device to carry over your
            courses, mastery, streaks and settings.
          </p>

          {/* Export side */}
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <ExportButton onClick={handleGenerateTransferCode} icon={<Smartphone className="h-4 w-4" />}>
                Generate Transfer Code
              </ExportButton>
              {transferCode && (
                <>
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    <Button variant="outline" size="sm" onClick={handleCopyTransferCode} className="hover:glow-emerald transition-shadow duration-300">
                      {copied ? <Check className="h-4 w-4 mr-2 text-emerald-500" /> : <Copy className="h-4 w-4 mr-2" />}
                      {copied ? 'Copied' : 'Copy Code'}
                    </Button>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    <Button variant="outline" size="sm" onClick={handleDownloadTransferCode} className="hover:glow-emerald transition-shadow duration-300">
                      <Download className="h-4 w-4 mr-2" />
                      Download .txt
                    </Button>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTransferCode('')}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Close
                    </Button>
                  </motion.div>
                </>
              )}
            </div>
            <AnimatePresence>
              {transferCode && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <Textarea
                    readOnly
                    value={transferCode}
                    onFocus={(e) => e.currentTarget.select()}
                    className="font-mono text-[10px] h-24 resize-none bg-muted/40"
                    aria-label="Transfer code"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Separator className="opacity-50" />

          {/* Import side */}
          <div className="space-y-2">
            <p className="text-sm font-medium flex items-center gap-2">
              <ClipboardPaste className="h-4 w-4 text-muted-foreground" />
              Restore on this device
            </p>
            <Textarea
              value={importCode}
              onChange={(e) => setImportCode(e.target.value)}
              placeholder="Paste a transfer code from your other device..."
              className="font-mono text-[10px] h-24 resize-none"
              aria-label="Paste transfer code"
            />
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="inline-block">
              <Button
                size="sm"
                disabled={!importCode.trim()}
                onClick={handleImportProfile}
                className="bg-linear-to-r from-indigo-600 to-blue-600 text-white hover:opacity-90"
              >
                Import Profile
              </Button>
            </motion.div>
            <p className="text-xs text-muted-foreground">
              Importing overwrites this device&apos;s profile and reloads the app.
            </p>
          </div>
        </div>
      </SectionCard>

      {/* Danger Zone */}
      <SectionCard
        icon={AlertTriangle}
        title="Danger Zone"
        gradientFrom="from-red-700"
        gradientTo="to-red-600"
        index={6}
        isDanger
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            These actions are irreversible. Please be certain before proceeding.
          </p>
          <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
            <AlertDialogTrigger asChild>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive border-red-500/30 hover:border-red-500/60 hover:bg-red-500/10 hover:shadow-[0_0_25px_rgba(239,68,68,0.15)] transition-all"
                >
                  <motion.div
                    animate={{ rotate: [0, 3, -3, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    className="mr-2"
                  >
                    <Trash2 className="h-4 w-4" />
                  </motion.div>
                  Reset All Data
                </Button>
              </motion.div>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive animate-pulse" />
                  Are you absolutely sure?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete everything this browser knows about you —
                  courses, notes, goals, mastery, streaks, achievements, settings and session
                  history. Consider generating a transfer code first. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleClearAllData}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Yes, clear everything
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </SectionCard>

      {/* About */}
      <SectionCard
        icon={Info}
        title="About"
        gradientFrom="from-zinc-600"
        gradientTo="to-stone-600"
        index={7}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">App Version</span>
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded"
            >
              1.0.0
            </motion.span>
          </div>
          <Separator className="opacity-50" />
          <div>
            <span className="text-sm font-medium">Tech Stack</span>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {['Next.js 16', 'TypeScript', 'Tailwind CSS 4', 'shadcn/ui', 'Prisma', 'Zustand', 'Framer Motion'].map((tech, idx) => (
                <motion.span
                  key={tech}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.05 * idx }}
                  whileHover={{ scale: 1.05, y: -1 }}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-background/80 border border-border rounded-md px-2 py-1 cursor-default hover:border-primary/30 hover:text-foreground transition-colors"
                >
                  <LayoutGrid className="h-2.5 w-2.5" />
                  {tech}
                </motion.span>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      <div className="pb-8" />
    </motion.div>
  );
}