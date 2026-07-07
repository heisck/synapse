'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, RotateCcw, SkipForward, CloudRain, Trees, Waves, Volume2, VolumeX, ChevronDown, ChevronUp, ArrowRight, Flame, Trophy, Lightbulb, Trash2, Clock, Target, TrendingUp, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAppStore } from '@/stores/appStore';
import { useCountUp } from '@/hooks/useCountUp';

// ─── Types ───────────────────────────────────────────────────────────────────

type TimerMode = 'focus' | 'short-break' | 'long-break' | 'custom';

interface FocusSession {
  date: string;       // YYYY-MM-DD
  duration: number;   // seconds
  completedAt: number; // timestamp
  topic?: string;
  mode?: string;
}

interface AmbientSound {
  id: string;
  label: string;
  icon: typeof CloudRain;
  volume: number;     // 0-100
  muted: boolean;
  playing: boolean;
}

const FOCUS_QUOTES = [
  '"The secret of getting ahead is getting started." — Mark Twain',
  '"It is during our darkest moments that we must focus to see the light." — Aristotle',
  '"Focus on being productive instead of busy." — Tim Ferriss',
  '"Where focus goes, energy flows." — Tony Robbins',
  '"Concentrate all your thoughts upon the work at hand. The sun\'s rays do not burn until brought to a focus." — Alexander Graham Bell',
  '"The successful warrior is the average man, with laser-like focus." — Bruce Lee',
  '"Do not dwell in the past, do not dream of the future, concentrate the mind on the present moment." — Buddha',
  '"Starve your distractions, feed your focus." — Daniel Goleman',
  '"You can always find a distraction if you\'re looking for one." — Tom Kite',
  '"The main thing is to keep the main thing the main thing." — Stephen Covey',
  '"My success, part of it certainly, is that I have focused in on a few things." — Bill Gates',
  '"When you focus on being a better person, you find that you are capable of extraordinary things." — Unknown',
];

const STORAGE_KEY = 'synapse-focus-sessions';

const MODE_DURATIONS: Record<string, number> = {
  focus: 25 * 60,
  'short-break': 5 * 60,
  'long-break': 15 * 60,
  custom: 10 * 60,
};

const MODE_LABELS: Record<string, string> = {
  focus: 'Focus',
  'short-break': 'Short Break',
  'long-break': 'Long Break',
  custom: 'Custom',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTodayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function loadSessions(): FocusSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: FocusSession[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

function getTodayStats() {
  const sessions = loadSessions();
  const today = getTodayStr();
  const todaySessions = sessions.filter((s) => s.date === today);
  return {
    completedCount: todaySessions.length,
    totalMinutes: Math.round(todaySessions.reduce((acc, s) => acc + s.duration, 0) / 60),
  };
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
}

function getDayName(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

function getDayNameFull(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}

// ─── Web Audio API Ambient Sounds ───────────────────────────────────────────

class AmbientSoundEngine {
  private ctx: AudioContext | null = null;
  private nodes: Map<string, { source: AudioNode; gain: GainNode; cleanup?: () => void }> = new Map();

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  startRain(volume: number) {
    this.stop('rain');
    const ctx = this.getCtx();
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 800;
    lowpass.Q.value = 0.7;

    const gain = ctx.createGain();
    gain.gain.value = volume / 100 * 0.5;

    source.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(ctx.destination);
    source.start();

    this.nodes.set('rain', { source, gain });
  }

  startForest(volume: number) {
    this.stop('forest');
    const ctx = this.getCtx();
    const bufferSize = 4 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // Brown noise generation
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = data[i];
      data[i] *= 3.5;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 400;
    bandpass.Q.value = 0.5;

    const gain = ctx.createGain();
    gain.gain.value = volume / 100 * 0.4;

    source.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(ctx.destination);
    source.start();

    this.nodes.set('forest', { source, gain });
  }

  startWaves(volume: number) {
    this.stop('waves');
    const ctx = this.getCtx();
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 0.15;

    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 200;

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.08;

    const mainOsc = ctx.createOscillator();
    mainOsc.type = 'sine';
    mainOsc.frequency.value = 100;

    const mainGain = ctx.createGain();
    mainGain.gain.value = volume / 100 * 0.3;

    lfo.connect(lfoGain);
    lfoGain.connect(mainOsc.frequency);
    mainOsc.connect(mainGain);
    mainGain.connect(ctx.destination);

    lfo.start();
    mainOsc.start();

    this.nodes.set('waves', {
      source: mainOsc,
      gain: mainGain,
      cleanup: () => {
        try { lfo.stop(); } catch { /* ignore */ }
      },
    });
  }

  setVolume(id: string, volume: number) {
    const entry = this.nodes.get(id);
    if (entry) {
      entry.gain.gain.setTargetAtTime(volume / 100 * 0.5, this.ctx?.currentTime ?? 0, 0.1);
    }
  }

  stop(id: string) {
    const entry = this.nodes.get(id);
    if (entry) {
      entry.cleanup?.();
      try {
        if (entry.source instanceof AudioBufferSourceNode || entry.source instanceof OscillatorNode) {
          entry.source.stop();
        }
      } catch { /* ignore */ }
      this.nodes.delete(id);
    }
  }

  stopAll() {
    this.nodes.forEach((_, id) => this.stop(id));
  }

  dispose() {
    this.stopAll();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function FocusTimerView() {
  // Timer state
  const [mode, setMode] = useState<TimerMode>('focus');
  const [customMinutes, setCustomMinutes] = useState(10);
  const [totalSeconds, setTotalSeconds] = useState(MODE_DURATIONS.focus);
  const [remainingSeconds, setRemainingSeconds] = useState(MODE_DURATIONS.focus);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionCount, setSessionCount] = useState(1);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [stats, setStats] = useState(() => getTodayStats());
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [showGoToTutor, setShowGoToTutor] = useState(false);

  // Analytics expand state
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [analyticsSessions, setAnalyticsSessions] = useState<FocusSession[]>(() => loadSessions());

  // App store
  const { addStudySession, checkAchievements, studySessions, navigate } = useAppStore();

  // Refresh analytics sessions when component gains focus or timer completes
  useEffect(() => {
    setAnalyticsSessions(loadSessions());
  }, [stats]);

  // Ambient sounds state
  const [sounds, setSounds] = useState<AmbientSound[]>([
    { id: 'rain', label: 'Rain', icon: CloudRain, volume: 60, muted: false, playing: false },
    { id: 'forest', label: 'Forest', icon: Trees, volume: 50, muted: false, playing: false },
    { id: 'waves', label: 'Waves', icon: Waves, volume: 40, muted: false, playing: false },
  ]);

  const engineRef = useRef<AmbientSoundEngine | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimestampRef = useRef<number>(0);
  const initialRemainingRef = useRef<number>(0);

  // Initialize audio engine
  useEffect(() => {
    engineRef.current = new AmbientSoundEngine();
    return () => {
      engineRef.current?.dispose();
    };
  }, []);

  // switchMode must be declared before handleTimerComplete (which calls it)
  const switchMode = useCallback((newMode: TimerMode) => {
    setIsRunning(false);
    setMode(newMode);

    if (newMode === 'custom') {
      const dur = customMinutes * 60;
      setTotalSeconds(dur);
      setRemainingSeconds(dur);
    } else {
      const dur = MODE_DURATIONS[newMode];
      setTotalSeconds(dur);
      setRemainingSeconds(dur);
    }
  }, [customMinutes]);

  // handleTimerComplete must be declared before the useEffect that calls it
  const handleTimerComplete = useCallback(() => {
    if (mode === 'focus') {
      // Record session to localStorage (existing behavior)
      const sessions = loadSessions();
      sessions.push({
        date: getTodayStr(),
        duration: totalSeconds,
        completedAt: Date.now(),
      });
      saveSessions(sessions);
      setStats(getTodayStats());

      // Sync to app store
      const focusDurationMinutes = Math.round(totalSeconds / 60);
      addStudySession({
        id: crypto.randomUUID(),
        date: new Date().toISOString().split('T')[0],
        duration: focusDurationMinutes,
        topic: 'Focus Session',
        messagesCount: 0,
        masteryGained: 0,
      });
      checkAchievements();
      setShowGoToTutor(true);

      // Next quote
      setQuoteIndex((prev) => (prev + 1) % FOCUS_QUOTES.length);

      if (sessionCount >= 4) {
        toast.success('Great work! You completed 4 focus sessions. Time for a long break!', {
          duration: 6000,
        });
        setSessionCount(1);
        switchMode('long-break');
      } else {
        toast.success('Focus session complete! Take a short break.', {
          action: {
            label: 'Start Break',
            onClick: () => switchMode('short-break'),
          },
          duration: 6000,
        });
        setSessionCount((prev) => prev + 1);
      }
    } else {
      toast.success('Break is over! Ready for another focus session?', {
        action: {
          label: 'Start Focus',
          onClick: () => switchMode('focus'),
        },
        duration: 6000,
      });
    }
  }, [mode, totalSeconds, sessionCount, switchMode, addStudySession, checkAchievements]);

  // Keep a ref to handleTimerComplete so the timer tick can call it
  const handleTimerCompleteRef = useRef(handleTimerComplete);

  // Timer tick
  useEffect(() => {
    handleTimerCompleteRef.current = handleTimerComplete;

    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            intervalRef.current = null;
            setIsRunning(false);
            // Schedule completion handler outside the setState updater
            setTimeout(() => handleTimerCompleteRef.current(), 0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, handleTimerComplete]);

  const handleStartPause = () => {
    if (isRunning) {
      setIsRunning(false);
    } else {
      if (remainingSeconds <= 0) {
        // Reset if timer ended
        if (mode === 'custom') {
          const dur = customMinutes * 60;
          setTotalSeconds(dur);
          setRemainingSeconds(dur);
        } else {
          const dur = MODE_DURATIONS[mode];
          setTotalSeconds(dur);
          setRemainingSeconds(dur);
        }
      }
      startTimestampRef.current = Date.now();
      initialRemainingRef.current = remainingSeconds;
      setIsRunning(true);
    }
  };

  const handleReset = () => {
    setIsRunning(false);
    if (mode === 'custom') {
      const dur = customMinutes * 60;
      setTotalSeconds(dur);
      setRemainingSeconds(dur);
    } else {
      const dur = MODE_DURATIONS[mode];
      setTotalSeconds(dur);
      setRemainingSeconds(dur);
    }
  };

  const handleSkip = () => {
    setIsRunning(false);
    if (mode === 'focus') {
      // Record partial focus session to app store
      const elapsed = totalSeconds - remainingSeconds;
      if (elapsed > 0) {
        const focusDurationMinutes = Math.round(elapsed / 60);
        addStudySession({
          id: crypto.randomUUID(),
          date: new Date().toISOString().split('T')[0],
          duration: focusDurationMinutes,
          topic: 'Focus Session',
          messagesCount: 0,
          masteryGained: 0,
        });
        checkAchievements();
        setShowGoToTutor(true);
      }
      if (sessionCount >= 4) {
        switchMode('long-break');
        setSessionCount(1);
      } else {
        switchMode('short-break');
      }
    } else {
      switchMode('focus');
    }
  };

  const toggleSound = (id: string) => {
    setSounds((prev) => {
      const next = prev.map((s) => {
        if (s.id !== id) return s;
        const willPlay = !s.playing;
        if (willPlay && engineRef.current) {
          const effectiveVolume = s.muted ? 0 : s.volume;
          if (id === 'rain') engineRef.current.startRain(effectiveVolume);
          if (id === 'forest') engineRef.current.startForest(effectiveVolume);
          if (id === 'waves') engineRef.current.startWaves(effectiveVolume);
        } else if (!willPlay && engineRef.current) {
          engineRef.current.stop(id);
        }
        return { ...s, playing: willPlay };
      });
      return next;
    });
  };

  const setSoundVolume = (id: string, volume: number) => {
    setSounds((prev) => {
      const next = prev.map((s) => {
        if (s.id !== id) return s;
        if (s.playing && engineRef.current && !s.muted) {
          if (id === 'rain') engineRef.current.setVolume(id, volume);
          if (id === 'forest') engineRef.current.setVolume(id, volume);
          if (id === 'waves') engineRef.current.setVolume(id, volume);
        }
        return { ...s, volume };
      });
      return next;
    });
  };

  const toggleSoundMute = (id: string) => {
    setSounds((prev) => {
      const next = prev.map((s) => {
        if (s.id !== id) return s;
        const willMute = !s.muted;
        if (s.playing && engineRef.current) {
          engineRef.current.setVolume(id, willMute ? 0 : s.volume);
        }
        return { ...s, muted: willMute };
      });
      return next;
    });
  };

  // Progress calculation
  const progress = totalSeconds > 0 ? ((totalSeconds - remainingSeconds) / totalSeconds) : 0;
  const circumference = 2 * Math.PI * 90;
  const strokeDashoffset = circumference * (1 - progress);

  const modeColor = mode === 'focus' || mode === 'custom'
    ? 'from-emerald-400 to-teal-400'
    : 'from-sky-400 to-cyan-400';

  // ─── Analytics Computation ─────────────────────────────────────────────────

  const analyticsData = useMemo(() => {
    const sessions = analyticsSessions;
    const today = new Date();

    // Get last 7 days
    const last7Days: { date: string; day: string; minutes: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const daySessions = sessions.filter((s) => s.date === dateStr);
      const minutes = Math.round(daySessions.reduce((acc, s) => acc + s.duration, 0) / 60);
      last7Days.push({ date: dateStr, day: getDayName(dateStr), minutes });
    }

    // This week total minutes
    const weekStart = new Date(today);
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    weekStart.setDate(today.getDate() - mondayOffset);
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekSessions = sessions.filter((s) => s.date >= weekStartStr);
    const totalWeekMinutes = Math.round(weekSessions.reduce((acc, s) => acc + s.duration, 0) / 60);

    // Average session length (minutes)
    const allFocusSessions = sessions.length > 0 ? sessions : [];
    const avgSessionMinutes = allFocusSessions.length > 0
      ? Math.round(allFocusSessions.reduce((acc, s) => acc + s.duration, 0) / allFocusSessions.length / 60)
      : 0;

    // Longest streak (consecutive days with sessions)
    const uniqueDates = [...new Set(sessions.map((s) => s.date))].sort().reverse();
    let longestStreak = 0;
    if (uniqueDates.length > 0) {
      let current = 1;
      for (let i = 1; i < uniqueDates.length; i++) {
        const prev = new Date(uniqueDates[i - 1] + 'T12:00:00');
        const curr = new Date(uniqueDates[i] + 'T12:00:00');
        const diffDays = Math.round((prev.getTime() - curr.getTime()) / 86400000);
        if (diffDays === 1) {
          current++;
        } else {
          longestStreak = Math.max(longestStreak, current);
          current = 1;
        }
      }
      longestStreak = Math.max(longestStreak, current);
    }

    // Best day (most productive)
    const dayTotals: Record<string, number> = {};
    sessions.forEach((s) => {
      dayTotals[s.date] = (dayTotals[s.date] || 0) + s.duration;
    });
    let bestDay = 'N/A';
    let bestDayMinutes = 0;
    Object.entries(dayTotals).forEach(([date, dur]) => {
      if (dur > bestDayMinutes) {
        bestDayMinutes = dur;
        bestDay = date;
      }
    });

    // Consistency (days this week with sessions, max 7)
    const daysWithSessionsThisWeek = new Set(
      weekSessions.map((s) => s.date)
    ).size;

    // Focus score (0-100)
    const weeklyGoalMinutes = 7 * 25; // 25 min * 7 days = 175 min
    const consistencyScore = Math.min(1, daysWithSessionsThisWeek / 7) * 40;
    const durationScore = Math.min(1, totalWeekMinutes / weeklyGoalMinutes) * 30;
    const streakScore = Math.min(1, longestStreak / 7) * 30;
    const focusScore = Math.round(consistencyScore + durationScore + streakScore);

    // Recent sessions (last 10, sorted by completedAt descending)
    const recentSessions = [...sessions]
      .sort((a, b) => b.completedAt - a.completedAt)
      .slice(0, 10);

    // Insights
    const insights: { text: string; type: 'productive' | 'suggestion' | 'warning' | 'streak' }[] = [];

    // Most productive day insight
    if (bestDay !== 'N/A' && Object.keys(dayTotals).length > 1) {
      insights.push({
        text: `You're most productive on ${getDayNameFull(bestDay)}s.`,
        type: 'productive',
      });
    }

    // Average session length suggestion
    if (avgSessionMinutes > 0) {
      if (avgSessionMinutes < 25) {
        insights.push({
          text: `Your average session is ${avgSessionMinutes} minutes. Try increasing by 5 min for better deep work.`,
          type: 'suggestion',
        });
      } else {
        insights.push({
          text: `Your average session is ${avgSessionMinutes} minutes. Great focus duration!`,
          type: 'productive',
        });
      }
    }

    // Days since last session
    if (sessions.length > 0) {
      const lastSession = Math.max(...sessions.map((s) => s.completedAt));
      const hoursSince = Math.floor((Date.now() - lastSession) / 3600000);
      if (hoursSince > 24) {
        insights.push({
          text: `You haven't studied in ${hoursSince >= 48 ? `${Math.floor(hoursSince / 24)} days` : 'over a day'}. Time to get back on track!`,
          type: 'warning',
        });
      }
    }

    // Sessions this week vs goal
    const weekSessionGoal = 14; // 2 per day
    if (weekSessions.length < weekSessionGoal) {
      insights.push({
        text: `You've completed ${weekSessions.length} sessions this week — ${weekSessionGoal - weekSessions.length} more to reach your goal.`,
        type: 'suggestion',
      });
    }

    // Focus score week-over-week comparison
    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekStartStr = lastWeekStart.toISOString().split('T')[0];
    const lastWeekSessions = sessions.filter((s) => s.date >= lastWeekStartStr && s.date < weekStartStr);
    const lastWeekDaysActive = new Set(lastWeekSessions.map((s) => s.date)).size;
    const lastWeekTotalMin = Math.round(lastWeekSessions.reduce((acc, s) => acc + s.duration, 0) / 60);
    const lastWeekStreak = (() => {
      const lastWeekDates = [...new Set(lastWeekSessions.map((s) => s.date))].sort().reverse();
      let s = 0;
      let c = 1;
      for (let i = 1; i < lastWeekDates.length; i++) {
        const prev = new Date(lastWeekDates[i - 1] + 'T12:00:00');
        const curr = new Date(lastWeekDates[i] + 'T12:00:00');
        const diff = Math.round((prev.getTime() - curr.getTime()) / 86400000);
        if (diff === 1) { c++; } else { s = Math.max(s, c); c = 1; }
      }
      return Math.max(s, c, lastWeekDates.length > 0 ? 1 : 0);
    })();
    const lastWeekConsistency = Math.min(1, lastWeekDaysActive / 7) * 40;
    const lastWeekDuration = Math.min(1, lastWeekTotalMin / weeklyGoalMinutes) * 30;
    const lastWeekStreakScore = Math.min(1, lastWeekStreak / 7) * 30;
    const lastWeekFocusScore = Math.round(lastWeekConsistency + lastWeekDuration + lastWeekStreakScore);
    if (lastWeekFocusScore > 0 && focusScore > lastWeekFocusScore) {
      const improvement = Math.round(((focusScore - lastWeekFocusScore) / lastWeekFocusScore) * 100);
      if (improvement > 0) {
        insights.push({
          text: `Your focus score improved by ${improvement}% compared to last week.`,
          type: 'streak',
        });
      }
    }

    // No session reminder
    const showReminder = sessions.length === 0 ||
      (sessions.length > 0 && (Date.now() - Math.max(...sessions.map((s) => s.completedAt))) > 86400000);

    return {
      weeklyChartData: last7Days,
      totalWeekMinutes,
      avgSessionMinutes,
      longestStreak,
      bestDay: bestDay === 'N/A' ? 'N/A' : getDayNameFull(bestDay),
      focusScore,
      recentSessions,
      insights,
      showReminder,
      daysWithSessionsThisWeek,
      weekSessionsCount: weekSessions.length,
    };
  }, [analyticsSessions]);

  // Animated counter values
  const animatedWeekMinutes = useCountUp(analyticsData.totalWeekMinutes, { duration: 1200, delay: 0.2 });
  const animatedAvgMinutes = useCountUp(analyticsData.avgSessionMinutes, { duration: 1200, delay: 0.3 });
  const animatedStreak = useCountUp(analyticsData.longestStreak, { duration: 1200, delay: 0.4 });
  const animatedScore = useCountUp(analyticsData.focusScore, { duration: 1500, delay: 0.5 });

  // Focus score color and label
  const scoreConfig = useMemo(() => {
    const score = analyticsData.focusScore;
    if (score < 30) return { color: '#ef4444', label: 'Needs Improvement', glow: false };
    if (score < 60) return { color: '#f59e0b', label: 'Getting There', glow: false };
    if (score < 80) return { color: '#10b981', label: 'Focused', glow: false };
    return { color: '#14b8a6', label: 'In the Zone', glow: true };
  }, [analyticsData.focusScore]);

  const scoreCircumference = 2 * Math.PI * 45;
  const scoreStrokeDashoffset = scoreCircumference * (1 - analyticsData.focusScore / 100);

  // Delete session handler
  const handleDeleteSession = useCallback((completedAt: number) => {
    const sessions = loadSessions();
    const filtered = sessions.filter((s) => s.completedAt !== completedAt);
    saveSessions(filtered);
    setAnalyticsSessions(filtered);
    setStats(getTodayStats());
    toast.success('Session deleted');
  }, []);

  // Duration color coding for history items
  const getDurationColor = (durationSec: number) => {
    const min = durationSec / 60;
    if (min < 15) return 'border-l-amber-400 bg-amber-400/5';
    if (min <= 25) return 'border-l-emerald-400 bg-emerald-400/5';
    return 'border-l-teal-400 bg-teal-400/5 shadow-[0_0_12px_rgba(20,184,166,0.15)]';
  };

  const getDurationBadgeColor = (durationSec: number) => {
    const min = durationSec / 60;
    if (min < 15) return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
    if (min <= 25) return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
    return 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20';
  };

  return (
    <div className="flex flex-col items-center gap-6 py-8 px-4 w-full max-w-2xl mx-auto">
      {/* Title */}
      <motion.h1
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl font-bold gradient-text-animated sm:text-3xl"
      >
        Focus Timer
      </motion.h1>

      {/* Mode selector tabs */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-wrap items-center justify-center gap-2"
      >
        {(['focus', 'short-break', 'long-break', 'custom'] as TimerMode[]).map((m) => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            className={`relative rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
              mode === m
                ? 'text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            }`}
          >
            {mode === m && (
              <motion.div
                layoutId="focus-mode-pill"
                className="absolute inset-0 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500"
                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              />
            )}
            <span className="relative z-10">{MODE_LABELS[m]}</span>
            {m !== 'custom' && (
              <span className="relative z-10 ml-1 opacity-70">{Math.round(MODE_DURATIONS[m] / 60)}m</span>
            )}
          </button>
        ))}
      </motion.div>

      {/* Custom minutes input */}
      <AnimatePresence>
        {mode === 'custom' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 overflow-hidden"
          >
            <label className="text-sm text-muted-foreground">Minutes:</label>
            <input
              type="number"
              min={1}
              max={120}
              value={customMinutes}
              onChange={(e) => {
                const val = Math.max(1, Math.min(120, parseInt(e.target.value) || 1));
                setCustomMinutes(val);
                if (!isRunning) {
                  const dur = val * 60;
                  setTotalSeconds(dur);
                  setRemainingSeconds(dur);
                }
              }}
              className="w-16 rounded-md border border-border/50 bg-muted/50 px-2 py-1 text-center text-sm outline-none focus:ring-1 focus:ring-primary/50"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Session counter */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="text-sm text-muted-foreground font-medium"
      >
        Session {sessionCount} of 4
      </motion.p>

      {/* Circular Timer Ring */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 20 }}
        className={`relative flex items-center justify-center ${isRunning ? 'breathe' : ''}`}
      >
        <svg width="220" height="220" viewBox="0 0 200 200" className="transform -rotate-90">
          <defs>
            <linearGradient id="timer-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#2dd4bf" />
            </linearGradient>
          </defs>
          {/* Background track */}
          <circle
            cx="100"
            cy="100"
            r="90"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            className="text-muted-foreground/10"
          />
          {/* Progress arc */}
          <motion.circle
            cx="100"
            cy="100"
            r="90"
            fill="none"
            stroke="url(#timer-gradient)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            animate={{ strokeDashoffset }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </svg>
        {/* Center time display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-5xl sm:text-6xl font-bold tabular-nums tracking-tight gradient-text-animated ${isRunning ? '' : ''}`}>
            {formatTime(remainingSeconds)}
          </span>
          <span className="mt-1 text-xs text-muted-foreground font-medium uppercase tracking-wider">
            {MODE_LABELS[mode]}
          </span>
        </div>
        {/* Glow ring effect when running */}
        {isRunning && (
          <motion.div
            className="absolute inset-0 rounded-full glow-emerald opacity-30"
            animate={{ scale: [1, 1.05, 1], opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </motion.div>

      {/* Controls */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex items-center gap-3"
      >
        <Button
          variant="outline"
          size="icon"
          onClick={handleReset}
          className="glass rounded-full h-11 w-11 hover:bg-accent/50"
          aria-label="Reset timer"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>

        <Button
          onClick={handleStartPause}
          className={`glass rounded-full h-14 w-14 glow-emerald ${
            isRunning ? 'glass-inner-glow' : ''
          }`}
          aria-label={isRunning ? 'Pause timer' : 'Start timer'}
        >
          {isRunning ? (
            <Pause className="h-5 w-5 text-primary-foreground" />
          ) : (
            <Play className="h-5 w-5 text-primary-foreground ml-0.5" />
          )}
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={handleSkip}
          className="glass rounded-full h-11 w-11 hover:bg-accent/50"
          aria-label="Skip to next mode"
        >
          <SkipForward className="h-4 w-4" />
        </Button>
      </motion.div>

      {/* Motivational Quote */}
      <motion.div
        key={quoteIndex}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center max-w-md"
      >
        <p className="text-sm text-muted-foreground italic leading-relaxed">
          {FOCUS_QUOTES[quoteIndex]}
        </p>
      </motion.div>

      {/* Ambient Sounds */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="w-full max-w-md glass-accent-top glass rounded-2xl p-4 space-y-3"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground/80">Ambient Sounds</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCustomInput((v) => !v)}
            className="h-7 px-2 text-xs text-muted-foreground"
          >
            {showCustomInput ? <ChevronUp className="h-3.5 w-3.5 mr-1" /> : <ChevronDown className="h-3.5 w-3.5 mr-1" />}
            {showCustomInput ? 'Collapse' : 'Expand'}
          </Button>
        </div>

        <AnimatePresence>
          {showCustomInput && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3 overflow-hidden"
            >
              {sounds.map((sound) => {
                const Icon = sound.icon;
                return (
                  <div key={sound.id} className="flex items-center gap-3">
                    <Button
                      variant={sound.playing ? 'default' : 'outline'}
                      size="icon"
                      onClick={() => toggleSound(sound.id)}
                      className={`h-9 w-9 rounded-lg shrink-0 transition-all duration-200 ${
                        sound.playing
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white'
                          : 'glass hover:bg-accent/50'
                      }`}
                      aria-label={`${sound.playing ? 'Stop' : 'Play'} ${sound.label}`}
                    >
                      <Icon className="h-4 w-4" />
                    </Button>
                    <span className="text-xs font-medium text-foreground/70 w-14 shrink-0">{sound.label}</span>
                    <Slider
                      value={[sound.volume]}
                      onValueChange={([v]) => setSoundVolume(sound.id, v)}
                      min={0}
                      max={100}
                      step={1}
                      className="flex-1"
                      disabled={!sound.playing}
                    />
                    <span className="text-[10px] text-muted-foreground w-7 text-right tabular-nums">
                      {sound.muted ? 'M' : `${sound.volume}`}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleSoundMute(sound.id)}
                      className="h-7 w-7 shrink-0"
                      aria-label={sound.muted ? 'Unmute' : 'Mute'}
                      disabled={!sound.playing}
                    >
                      {sound.muted ? (
                        <VolumeX className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick toggle buttons when collapsed */}
        {!showCustomInput && (
          <div className="flex items-center justify-center gap-2 pt-1">
            {sounds.map((sound) => {
              const Icon = sound.icon;
              return (
                <Button
                  key={sound.id}
                  variant={sound.playing ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleSound(sound.id)}
                  className={`rounded-lg text-xs transition-all duration-200 gap-1.5 ${
                    sound.playing
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white'
                      : 'glass text-muted-foreground hover:text-foreground'
                  }`}
                  aria-label={`${sound.playing ? 'Stop' : 'Play'} ${sound.label}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {sound.label}
                </Button>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Stats Bar */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="w-full max-w-md glass rounded-xl p-4"
      >
        <div className="flex items-center justify-around">
          <div className="flex flex-col items-center gap-1">
            <span className="text-2xl font-bold gradient-text">{stats.completedCount}</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Sessions Today
            </span>
          </div>
          <div className="h-8 w-px bg-border/50" />
          <div className="flex flex-col items-center gap-1">
            <span className="text-2xl font-bold gradient-text">{studySessions.length}</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Total Sessions
            </span>
          </div>
          <div className="h-8 w-px bg-border/50" />
          <div className="flex flex-col items-center gap-1">
            <span className="text-2xl font-bold gradient-text">{stats.totalMinutes}</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Focus Minutes
            </span>
          </div>
        </div>
      </motion.div>

      {/* Session Analytics Expand Button */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55 }}
        className="w-full max-w-md"
      >
        <Button
          variant="outline"
          onClick={() => setShowAnalytics((v) => !v)}
          className="w-full glass rounded-xl py-3 flex items-center justify-center gap-2 text-sm font-medium text-foreground/70 hover:text-foreground hover:bg-accent/30 transition-colors"
        >
          <TrendingUp className="h-4 w-4" />
          Session Analytics
          {showAnalytics ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </Button>
      </motion.div>

      <AnimatePresence>
        {showAnalytics && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.4, ease: [0.04, 0.62, 0.23, 0.98] }}
            className="w-full max-w-2xl overflow-hidden"
          >
            <div className="flex flex-col gap-6">

              {/* Focus Score + Stats Cards Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Focus Score Gauge */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 350, damping: 22, delay: 0.05 }}
                  className="glass rounded-2xl p-5 flex flex-col items-center justify-center neon-border"
                >
                  <div className="relative">
                    <svg width="110" height="110" viewBox="0 0 100 100" className="transform -rotate-90">
                      <defs>
                        <linearGradient id="score-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#10b981" />
                          <stop offset="100%" stopColor="#14b8a6" />
                        </linearGradient>
                      </defs>
                      <circle
                        cx="50" cy="50" r="45"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="6"
                        className="text-muted-foreground/10"
                      />
                      <motion.circle
                        cx="50" cy="50" r="45"
                        fill="none"
                        stroke={scoreConfig.color}
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={scoreCircumference}
                        initial={{ strokeDashoffset: scoreCircumference }}
                        animate={{ strokeDashoffset: scoreStrokeDashoffset }}
                        transition={{ duration: 1.5, ease: 'easeOut', delay: 0.3 }}
                        style={scoreConfig.glow ? { filter: 'drop-shadow(0 0 6px rgba(20,184,166,0.5))' } : undefined}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold tabular-nums" style={{ color: scoreConfig.color }}>
                        {animatedScore}
                      </span>
                    </div>
                  </div>
                  <span className="mt-2 text-xs font-medium text-muted-foreground">Focus Score</span>
                  <span className="text-[10px] font-semibold mt-0.5" style={{ color: scoreConfig.color }}>
                    {scoreConfig.label}
                  </span>
                </motion.div>

                {/* Total Focus Time */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 350, damping: 22, delay: 0.1 }}
                  className="glass rounded-2xl p-5 flex flex-col items-center justify-center glass-card-3d"
                >
                  <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-2">
                    <Clock className="h-4 w-4 text-emerald-500" />
                  </div>
                  <span className="text-2xl font-bold gradient-text tabular-nums">
                    {animatedWeekMinutes}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mt-1">
                    Min This Week
                  </span>
                </motion.div>

                {/* Average Session */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 350, damping: 22, delay: 0.15 }}
                  className="glass rounded-2xl p-5 flex flex-col items-center justify-center glass-card-3d"
                >
                  <div className="h-8 w-8 rounded-lg bg-teal-500/10 flex items-center justify-center mb-2">
                    <Target className="h-4 w-4 text-teal-500" />
                  </div>
                  <span className="text-2xl font-bold gradient-text tabular-nums">
                    {animatedAvgMinutes}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mt-1">
                    Avg Minutes
                  </span>
                </motion.div>
              </div>

              {/* Streak + Best Day Row */}
              <div className="grid grid-cols-2 gap-4">
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 350, damping: 22, delay: 0.2 }}
                  className="glass rounded-2xl p-4 flex items-center gap-3"
                >
                  <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0">
                    <Flame className="h-5 w-5 text-orange-500" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xl font-bold gradient-text tabular-nums">{animatedStreak}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                      Longest Streak
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 350, damping: 22, delay: 0.25 }}
                  className="glass rounded-2xl p-4 flex items-center gap-3"
                >
                  <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                    <Trophy className="h-5 w-5 text-amber-500" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-foreground truncate">{analyticsData.bestDay}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                      Best Day
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Weekly Session Chart */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 22, delay: 0.1 }}
                className="glass rounded-2xl p-5 hidden sm:block breathing-border"
              >
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  <h3 className="text-sm font-semibold text-foreground/80">Weekly Focus Time</h3>
                  <span className="text-[10px] text-muted-foreground ml-auto">minutes per day</span>
                </div>
                <div style={{ minHeight: 180 }}>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={analyticsData.weeklyChartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                      <defs>
                        <linearGradient id="analytics-bar-gradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" />
                          <stop offset="100%" stopColor="#14b8a6" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '12px',
                          color: 'hsl(var(--foreground))',
                        }}
                        cursor={{ fill: 'hsl(var(--accent))', opacity: 0.3 }}
                        formatter={(value: number) => [`${value} min`, 'Focus Time']}
                      />
                      <Bar
                        dataKey="minutes"
                        fill="url(#analytics-bar-gradient)"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={36}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>

              {/* AI-Powered Insights */}
              {analyticsData.insights.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 22, delay: 0.15 }}
                  className="space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-amber-500" />
                    <h3 className="text-sm font-semibold text-foreground/80">Focus Insights</h3>
                  </div>
                  {analyticsData.insights.map((insight, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.2 + index * 0.08 }}
                      className={`glass rounded-xl p-3.5 border-l-2 ${
                        insight.type === 'productive'
                          ? 'border-l-emerald-500'
                          : insight.type === 'suggestion'
                            ? 'border-l-sky-500'
                            : insight.type === 'warning'
                              ? 'border-l-amber-500'
                              : 'border-l-teal-500'
                      }`}
                    >
                      <p className="text-xs text-foreground/80 leading-relaxed">{insight.text}</p>
                    </motion.div>
                  ))}
                </motion.div>
              )}

              {/* Focus Reminder */}
              {analyticsData.showReminder && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 22, delay: 0.25 }}
                  className="glass rounded-2xl p-4 flex items-center gap-3 border border-emerald-500/20"
                >
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <AlertCircle className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground/90">Ready for a focus session?</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Start a timer to build your streak</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      switchMode('focus');
                      setShowAnalytics(false);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-lg px-4 shrink-0"
                  >
                    Start
                  </Button>
                </motion.div>
              )}

              {/* Session History List */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 22, delay: 0.2 }}
                className="glass rounded-2xl p-5"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="h-4 w-4 text-emerald-500" />
                  <h3 className="text-sm font-semibold text-foreground/80">Recent Sessions</h3>
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {analyticsData.recentSessions.length} of {analyticsSessions.length}
                  </span>
                </div>

                {analyticsData.recentSessions.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">No sessions yet</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Complete a focus session to see your history</p>
                  </div>
                ) : (
                  <div className="max-h-96 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {analyticsData.recentSessions.map((session, index) => {
                      const durationMin = Math.round(session.duration / 60);
                      const durationSec = session.duration % 60;
                      return (
                        <motion.div
                          key={session.completedAt}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 25, delay: 0.05 + index * 0.04 }}
                          className={`flex items-center gap-3 rounded-xl p-3 border-l-3 ${getDurationColor(session.duration)} transition-colors`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-foreground/90">
                                {durationMin > 0 ? `${durationMin}m` : ''}{durationSec > 0 && durationMin === 0 ? `${durationSec}s` : ''}
                                {durationMin > 0 && durationSec > 0 ? ` ${durationSec}s` : ''}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 h-4 font-medium ${getDurationBadgeColor(session.duration)}`}
                              >
                                Focus
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] text-muted-foreground">
                                {formatRelativeTime(session.completedAt)}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteSession(session.completedAt)}
                            className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-destructive/10 transition-colors shrink-0"
                            aria-label="Delete session"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                          </button>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </motion.div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Go to Tutor button (after focus completion) */}
      <AnimatePresence>
        {showGoToTutor && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.3 }}
          >
            <Button
              onClick={() => navigate('tutor')}
              className="gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-full px-6"
            >
              Go to Tutor
              <ArrowRight className="h-4 w-4" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}