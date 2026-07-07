'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { toast } from 'sonner';
import { useAppStore } from '@/stores/appStore';
import { useTheme } from 'next-themes';

const stagger = {
  animate: { transition: { staggerChildren: 0.07 } },
};
const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

function AnimatedIcon({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      animate={{ y: [0, -2, 0] }}
      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
    >
      {children}
    </motion.div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  gradientFrom,
  gradientTo,
  children,
  index,
  isDanger = false,
}: {
  icon: typeof Palette;
  title: string;
  gradientFrom: string;
  gradientTo: string;
  children: React.ReactNode;
  index: number;
  isDanger?: boolean;
}) {
  return (
    <motion.div
      variants={fadeUp}
      className={`glass rounded-xl overflow-hidden gradient-border card-shadow card-hover-lift ${
        isDanger
          ? '[&_::before]:from-red-500/50 [&_::before]:via-red-500/20 [&_::before]:to-orange-500/50'
          : ''
      }`}
    >
      <div className={`${isDanger ? 'bg-gradient-to-r from-red-600 to-orange-600' : `bg-gradient-to-r ${gradientFrom} ${gradientTo}`} px-5 py-3 flex items-center gap-2.5 relative overflow-hidden`}>
        {/* Subtle shimmer on header */}
        <motion.div
          className="absolute inset-0 -translate-x-full"
          animate={{ translateX: ['-100%', '100%', '200%'] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear', delay: index * 0.5 }}
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
          }}
        />
        <div className="relative z-10 flex items-center gap-2.5">
          {isDanger ? (
            <motion.div
              animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="pulse-soft"
            >
              <Icon className="h-4 w-4 text-white" />
            </motion.div>
          ) : (
            <AnimatedIcon>
              <Icon className="h-4 w-4 text-white" />
            </AnimatedIcon>
          )}
          <h3 className="text-sm font-semibold text-white">{title}</h3>
        </div>
      </div>
      <div className={`p-5 space-y-4 ${isDanger ? 'bg-red-500/[0.02] dark:bg-red-500/[0.03]' : ''}`}>
        {children}
      </div>
    </motion.div>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 group">
      <div className="min-w-0">
        <p className="text-sm font-medium group-hover:text-foreground transition-colors">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function AnimatedSwitch({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: (checked: boolean) => void }) {
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

export function SettingsView() {
  const { settings, updateSettings, notes } = useAppStore();
  const { setTheme, theme } = useTheme();
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleThemeChange = (value: string) => {
    setTheme(value);
    updateSettings({ theme: value as 'light' | 'dark' | 'system' });
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
          version: '1.0.0',
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
      const keysToClear = [
        'synapse-notes',
        'synapse-goals',
        'synapse-settings',
        'synapse-last-session',
      ];
      keysToClear.forEach((key) => localStorage.removeItem(key));
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
      className="space-y-6 pt-2 lg:pt-4 max-w-3xl"
    >
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-bold gradient-text">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
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
        <SettingRow label="Theme" description="Choose your preferred color scheme">
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
          />
        </SettingRow>
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
            <SelectItem value="storyteller">Storyteller</SelectItem>
            <SelectItem value="socratic">Socratic</SelectItem>
            <SelectItem value="encyclopedic">Encyclopedic</SelectItem>
            <SelectItem value="friendly">Friendly Coach</SelectItem>
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
        <SettingRow label="Auto-Break Reminders" description="Get notified to take breaks during long sessions">
          <AnimatedSwitch
            checked={settings.autoBreakReminders}
            onCheckedChange={(checked) => updateSettings({ autoBreakReminders: checked })}
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
          />
        </SettingRow>
        <Separator className="opacity-50" />
        <SettingRow label="Streak Alerts" description="Alerts when your study streak is at risk">
          <AnimatedSwitch
            checked={settings.streakAlerts}
            onCheckedChange={(checked) => updateSettings({ streakAlerts: checked })}
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
          <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
            <AlertDialogTrigger asChild>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/50 hover:bg-destructive/5 hover:shadow-[0_0_20px_rgba(239,68,68,0.1)] pulse-border-glow transition-all">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear All Data
                </Button>
              </motion.div>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Clear all data?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all your notes, goals, settings, and session history.
                  This action cannot be undone.
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

      {/* Danger Zone */}
      <SectionCard
        icon={AlertTriangle}
        title="Danger Zone"
        gradientFrom="from-red-700"
        gradientTo="to-red-600"
        index={5}
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
                  This will permanently delete all your notes, goals, settings, and session history.
                  This action cannot be undone.
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
        index={6}
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