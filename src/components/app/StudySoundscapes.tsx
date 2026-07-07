'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Volume2, VolumeX, Waves, TreePine, Coffee, Wind, CloudRain, Flame, Droplets, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/stores/appStore';

interface SoundChannel {
  id: string;
  name: string;
  icon: typeof Waves;
  color: string;
  activeColor: string;
  /** Frequency in Hz for oscillator-based sounds */
  frequency?: number;
  /** Type of noise generator */
  noiseType?: 'white' | 'pink' | 'brown';
  /** Volume range */
  defaultVolume: number;
}

const SOUNDS: SoundChannel[] = [
  { id: 'rain', name: 'Rain', icon: CloudRain, color: 'text-blue-400', activeColor: 'text-blue-300', noiseType: 'brown', defaultVolume: 30 },
  { id: 'forest', name: 'Forest', icon: TreePine, color: 'text-emerald-400', activeColor: 'text-emerald-300', noiseType: 'pink', defaultVolume: 25 },
  { id: 'cafe', name: 'Cafe', icon: Coffee, color: 'text-amber-400', activeColor: 'text-amber-300', noiseType: 'pink', defaultVolume: 20 },
  { id: 'wind', name: 'Wind', icon: Wind, color: 'text-cyan-400', activeColor: 'text-cyan-300', noiseType: 'white', defaultVolume: 15 },
  { id: 'fire', name: 'Fire', icon: Flame, color: 'text-orange-400', activeColor: 'text-orange-300', frequency: 60, defaultVolume: 10 },
  { id: 'stream', name: 'Stream', icon: Droplets, color: 'text-sky-400', activeColor: 'text-sky-300', noiseType: 'brown', defaultVolume: 20 },
  { id: 'music', name: 'Drone', icon: Music, color: 'text-violet-400', activeColor: 'text-violet-300', frequency: 220, defaultVolume: 5 },
  { id: 'waves', name: 'Waves', icon: Waves, color: 'text-teal-400', activeColor: 'text-teal-300', frequency: 40, defaultVolume: 15 },
];

/** Generate noise buffer using Web Audio API */
function createNoiseBuffer(ctx: AudioContext, type: 'white' | 'pink' | 'brown', duration: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * duration;
  const buffer = ctx.createBuffer(2, length, sampleRate);

  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);

    if (type === 'white') {
      for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    } else if (type === 'pink') {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
    } else {
      // Brown noise
      let lastOut = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = data[i];
        data[i] *= 3.5;
      }
    }
  }

  return buffer;
}

export function StudySoundscapes() {
  const [isOpen, setIsOpen] = useState(false);
  const [masterMuted, setMasterMuted] = useState(false);
  const [activeSoundIds, setActiveSoundIds] = useState<Set<string>>(new Set());
  const [volumes, setVolumes] = useState<Record<string, number>>(() => {
    const defaults: Record<string, number> = {};
    SOUNDS.forEach((s) => { defaults[s.id] = s.defaultVolume; });
    return defaults;
  });

  const ctxRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef<Record<string, AudioBufferSourceNode | OscillatorNode>>({});
  const gainNodesRef = useRef<Record<string, GainNode>>({});
  const masterGainRef = useRef<GainNode | null>(null);

  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
      masterGainRef.current = ctxRef.current.createGain();
      masterGainRef.current.gain.value = masterMuted ? 0 : 1;
      masterGainRef.current.connect(ctxRef.current.destination);
    }
    if (ctxRef.current.state === 'suspended') {
      ctxRef.current.resume();
    }
    return ctxRef.current;
  }, [masterMuted]);

  const startSound = useCallback((sound: SoundChannel) => {
    const ctx = getCtx();

    // Stop existing source if any
    if (sourcesRef.current[sound.id]) {
      try { sourcesRef.current[sound.id].stop(); } catch { /* ignore */ }
    }

    let source: AudioBufferSourceNode | OscillatorNode;
    const gain = ctx.createGain();
    gain.gain.value = (volumes[sound.id] || sound.defaultVolume) / 100;
    gain.connect(masterGainRef.current!);

    if (sound.noiseType) {
      // Noise-based sound
      const buffer = createNoiseBuffer(ctx, sound.noiseType, 4);
      const bufferSource = ctx.createBufferSource();
      bufferSource.buffer = buffer;
      bufferSource.loop = true;
      bufferSource.connect(gain);
      bufferSource.start();
      source = bufferSource;
    } else if (sound.frequency) {
      // Oscillator-based sound (drone)
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = sound.frequency;
      // Add subtle vibrato
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.5;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 2;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start();

      osc.connect(gain);
      osc.start();
      source = osc;
    } else {
      console.error(`[StudySoundscapes] Sound "${sound.id}" has neither noiseType nor frequency configured — skipping.`);
      return;
    }

    sourcesRef.current[sound.id] = source;
    gainNodesRef.current[sound.id] = gain;
    setActiveSoundIds((prev) => new Set(prev).add(sound.id));
  }, [getCtx, volumes]);

  const stopSound = useCallback((soundId: string) => {
    if (sourcesRef.current[soundId]) {
      try {
        sourcesRef.current[soundId].stop();
      } catch { /* ignore */ }
      delete sourcesRef.current[soundId];
    }
    if (gainNodesRef.current[soundId]) {
      delete gainNodesRef.current[soundId];
    }
    setActiveSoundIds((prev) => {
      const next = new Set(prev);
      next.delete(soundId);
      return next;
    });
  }, []);

  const toggleSound = useCallback((sound: SoundChannel) => {
    if (sourcesRef.current[sound.id]) {
      stopSound(sound.id);
      setVolumes((prev) => ({ ...prev, [sound.id]: 0 }));
    } else {
      setVolumes((prev) => {
        const newVol = prev[sound.id] > 0 ? prev[sound.id] : sound.defaultVolume;
        const newVolumes = { ...prev, [sound.id]: newVol };
        // Start the sound with the new volume
        setTimeout(() => {
          startSound({ ...sound });
          if (gainNodesRef.current[sound.id]) {
            gainNodesRef.current[sound.id].gain.value = newVol / 100;
          }
        }, 0);
        return newVolumes;
      });
    }
  }, [startSound, stopSound]);

  const handleVolumeChange = useCallback((soundId: string, newVol: number[]) => {
    const vol = newVol[0];
    setVolumes((prev) => ({ ...prev, [soundId]: vol }));

    if (gainNodesRef.current[soundId]) {
      gainNodesRef.current[soundId].gain.value = vol / 100;
    }

    // Auto-stop if volume goes to 0
    if (vol === 0) {
      stopSound(soundId);
    } else if (!sourcesRef.current[soundId]) {
      const sound = SOUNDS.find((s) => s.id === soundId);
      if (sound) startSound(sound);
    }
  }, [startSound, stopSound]);

  const toggleMasterMute = useCallback(() => {
    setMasterMuted((prev) => {
      const newVal = !prev;
      if (masterGainRef.current) {
        masterGainRef.current.gain.value = newVal ? 0 : 1;
      }
      return newVal;
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.keys(sourcesRef.current).forEach((id) => {
        try { sourcesRef.current[id].stop(); } catch { /* ignore */ }
      });
      if (ctxRef.current) {
        ctxRef.current.close();
      }
    };
  }, []);

  const activeCount = activeSoundIds.size;

  return (
    <div className="relative">
      {/* Toggle Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className={`gap-2 relative ${isOpen ? 'glass-card-shine' : ''}`}
      >
        {masterMuted ? (
          <VolumeX className="h-4 w-4 text-muted-foreground" />
        ) : (
          <Volume2 className="h-4 w-4 text-primary" />
        )}
        <span className="hidden sm:inline text-xs">Soundscapes</span>
        {activeCount > 0 && !isOpen && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-primary glow-dot"
          />
        )}
      </Button>

      {/* Expanded Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="absolute top-full mt-2 right-0 z-50 w-80 glass-blur-strong rounded-xl p-4 shadow-xl border border-border/50"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">Study Soundscapes</h3>
              <Button variant="ghost" size="sm" onClick={toggleMasterMute} className="h-7 w-7 p-0">
                {masterMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4 text-primary" />}
              </Button>
            </div>

            {/* Sound Grid */}
            <div className="grid grid-cols-2 gap-2">
              {SOUNDS.map((sound) => {
                const isActive = activeSoundIds.has(sound.id);
                const Icon = sound.icon;
                return (
                  <motion.div
                    key={sound.id}
                    whileTap={{ scale: 0.95 }}
                    className={`rounded-lg p-2.5 cursor-pointer transition-all duration-200 border ${
                      isActive
                        ? 'bg-primary/10 border-primary/30 shadow-sm'
                        : 'bg-muted/30 border-transparent hover:bg-muted/50'
                    }`}
                    onClick={() => toggleSound(sound)}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <Icon className={`h-3.5 w-3.5 ${isActive ? sound.activeColor : sound.color} transition-colors`} />
                      <span className={`text-xs font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {sound.name}
                      </span>
                    </div>
                    <Slider
                      value={[volumes[sound.id] || 0]}
                      min={0}
                      max={100}
                      step={1}
                      onValueChange={(v) => handleVolumeChange(sound.id, v)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-1.5"
                    />
                  </motion.div>
                );
              })}
            </div>

            {/* Preset Buttons */}
            <div className="flex gap-2 mt-3 pt-3 border-t border-border/30">
              {[
                { label: 'Focus', sounds: ['rain', 'fire'] },
                { label: 'Calm', sounds: ['forest', 'stream'] },
                { label: 'Cafe', sounds: ['cafe', 'music'] },
                { label: 'Nature', sounds: ['wind', 'waves'] },
              ].map((preset) => (
                <Button
                  key={preset.label}
                  variant="outline"
                  size="sm"
                  className="flex-1 text-[10px] h-7"
                  onClick={() => {
                    // Stop all, then start preset
                    SOUNDS.forEach((s) => stopSound(s.id));
                    const newVolumes: Record<string, number> = {};
                    SOUNDS.forEach((s) => { newVolumes[s.id] = 0; });
                    preset.sounds.forEach((pid) => {
                      const ps = SOUNDS.find((s) => s.id === pid);
                      if (ps) {
                        newVolumes[pid] = ps.defaultVolume;
                        setTimeout(() => startSound(ps), 0);
                      }
                    });
                    setVolumes(newVolumes);
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
