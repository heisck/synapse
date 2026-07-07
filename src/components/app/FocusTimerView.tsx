'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, RotateCcw, SkipForward, CloudRain, Trees, Waves, Volume2, VolumeX, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';

// ─── Types ───────────────────────────────────────────────────────────────────

type TimerMode = 'focus' | 'short-break' | 'long-break' | 'custom';

interface FocusSession {
  date: string;       // YYYY-MM-DD
  duration: number;   // seconds
  completedAt: number; // timestamp
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
      // Record session
      const sessions = loadSessions();
      sessions.push({
        date: getTodayStr(),
        duration: totalSeconds,
        completedAt: Date.now(),
      });
      saveSessions(sessions);
      setStats(getTodayStats());

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
  }, [mode, totalSeconds, sessionCount, switchMode]);

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
            <span className="text-2xl font-bold gradient-text">{stats.totalMinutes}</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Focus Minutes
            </span>
          </div>
          <div className="h-8 w-px bg-border/50" />
          <div className="flex flex-col items-center gap-1">
            <span className="text-2xl font-bold gradient-text">
              {stats.completedCount > 0 ? Math.round(stats.totalMinutes / stats.completedCount) : 0}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Avg Min/Session
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}