'use client'

/**
 * Voice conversation mode — an OpenAI-voice-mode-style loop built entirely
 * from free, in-browser open source pieces (rule R1: no audio leaves the
 * device; the only network call is the normal /api/chat text request):
 *
 *   mic → Silero VAD (@ricky0123/vad-web, ONNX)   — turn-taking + barge-in
 *       → Whisper base (transformers.js)           — local transcription
 *       → /api/chat stream:true voiceMode:true     — free OpenRouter models
 *       → kokoro-js TextSplitterStream             — sentence-streamed TTS
 *       → sequential audio queue                    — playback, interruptible
 *
 * Barge-in: the VAD keeps listening WHILE the tutor speaks. When the learner
 * starts talking, playback stops, the in-flight LLM stream aborts, and their
 * new utterance becomes the next turn — exactly like talking over someone.
 * Turns are guarded by a token: any async work from a stale turn exits.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Mic, MicOff, Loader2 } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { aiFetch } from '@/lib/aiKey'
import { transcribeAudio, warmUpWhisper, onWhisperStatus, getWhisperStatus, type WhisperStatus } from '@/lib/voice/stt'
import { getKokoro, getSelectedVoice, resolveVoiceId } from '@/lib/voice/tts'

type VoiceState = 'connecting' | 'listening' | 'transcribing' | 'thinking' | 'speaking' | 'error'

const STATE_LABEL: Record<VoiceState, string> = {
  connecting: 'Getting ready…',
  listening: 'Listening — just talk',
  transcribing: 'Heard you…',
  thinking: 'Thinking…',
  speaking: 'Speaking — interrupt any time',
  error: 'Voice mode unavailable',
}

interface MicVADInstance {
  start: () => void
  pause: () => void
  destroy: () => void
}

export function VoiceMode({ onClose }: { onClose: () => void }) {
  const activeCourse = useAppStore((s) => s.activeCourse)
  const activeTopic = useAppStore((s) => s.activeTopic)
  const activeSlides = useAppStore((s) => s.activeSlides)
  const currentSlideIndex = useAppStore((s) => s.currentSlideIndex)

  const [state, setState] = useState<VoiceState>('connecting')
  const [userCaption, setUserCaption] = useState('')
  const [aiCaption, setAiCaption] = useState('')
  const [muted, setMuted] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  // Live visibility: mic speech-probability from the VAD (proof it hears you)
  // + Whisper download status (the silent first-use wait, made visible)
  const [vadLevel, setVadLevel] = useState(0)
  const [whisper, setWhisper] = useState<{ status: WhisperStatus; progress: number }>(() => getWhisperStatus())

  // Everything async checks this token — an interrupt or a new turn bumps it
  const turnRef = useRef(0)
  const vadRef = useRef<MicVADInstance | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioQueueRef = useRef<string[]>([])
  const playingRef = useRef(false)
  const stateRef = useRef<VoiceState>('connecting')
  const mutedRef = useRef(false)
  // Voice-mode conversation history (also mirrored into the tutor session)
  const historyRef = useRef<Array<{ role: 'user' | 'assistant'; content: string }>>([])

  const setVoiceState = useCallback((s: VoiceState) => {
    stateRef.current = s
    setState(s)
  }, [])

  const stopPlayback = useCallback(() => {
    playingRef.current = false
    for (const url of audioQueueRef.current) URL.revokeObjectURL(url)
    audioQueueRef.current = []
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
    }
  }, [])

  /** Cuts everything belonging to the current turn (barge-in or close). */
  const interrupt = useCallback(() => {
    turnRef.current++
    abortRef.current?.abort()
    abortRef.current = null
    stopPlayback()
  }, [stopPlayback])

  /** Plays queued blob-urls one after another; returns when queue drains. */
  const drainAudioQueue = useCallback(async (token: number) => {
    if (playingRef.current) return
    playingRef.current = true
    while (audioQueueRef.current.length > 0 && token === turnRef.current) {
      const url = audioQueueRef.current.shift()!
      await new Promise<void>((resolve) => {
        const el = new Audio(url)
        audioRef.current = el
        const done = () => {
          URL.revokeObjectURL(url)
          if (audioRef.current === el) audioRef.current = null
          resolve()
        }
        el.onended = done
        el.onerror = done
        el.play().catch(done)
      })
    }
    playingRef.current = false
  }, [])

  /** One full conversation turn: text in → streamed reply → spoken out. */
  const runTurn = useCallback(async (userText: string) => {
    const token = ++turnRef.current
    const store = useAppStore.getState()
    const sessionId = store.activeSessionId ?? crypto.randomUUID()
    if (!store.activeSessionId) store.setActiveSession(sessionId, activeCourse?.id, activeCourse?.title ?? 'Voice Session')

    setUserCaption(userText)
    setAiCaption('')
    setVoiceState('thinking')
    historyRef.current.push({ role: 'user', content: userText })
    // Mirror into the tutor thread so the session continues in text later
    store.addMessage({ id: crypto.randomUUID(), sessionId, role: 'user', content: userText, createdAt: new Date().toISOString() })

    const controller = new AbortController()
    abortRef.current = controller
    let fullText = ''
    try {
      const res = await aiFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          message: userText,
          stream: true,
          voiceMode: true,
          history: historyRef.current.slice(-16, -1),
          topic: activeTopic || activeCourse?.title,
          slideContext: activeSlides.length > 0
            ? {
                courseTitle: activeCourse?.title,
                index: currentSlideIndex + 1,
                total: activeSlides.length,
                title: activeSlides[currentSlideIndex]?.title,
                content: (activeSlides[currentSlideIndex]?.content || '').slice(0, 1500),
              }
            : undefined,
        }),
      })
      if (!res.ok || !res.body) throw new Error('chat request failed')

      const kokoro = await getKokoro()
      const voice = resolveVoiceId(getSelectedVoice())
      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      if (kokoro) {
        // Sentence-streamed synthesis: LLM tokens feed the splitter, kokoro
        // yields per-sentence audio, the queue plays as it fills.
        const { TextSplitterStream } = await import('kokoro-js')
        const splitter = new TextSplitterStream()
        const synthesis = (async () => {
          for await (const chunk of kokoro.stream(splitter, { voice })) {
            if (token !== turnRef.current) break
            audioQueueRef.current.push(URL.createObjectURL(chunk.audio.toBlob()))
            if (stateRef.current !== 'speaking' && token === turnRef.current) setVoiceState('speaking')
            void drainAudioQueue(token)
          }
        })()
        for (;;) {
          const { done, value } = await reader.read()
          if (done || token !== turnRef.current) break
          const text = decoder.decode(value, { stream: true })
          fullText += text
          setAiCaption(fullText)
          splitter.push(text)
        }
        try { splitter.close() } catch { /* already closed */ }
        await synthesis
        // Wait for the tail of the queue to finish playing
        while ((playingRef.current || audioQueueRef.current.length > 0) && token === turnRef.current) {
          await new Promise((r) => setTimeout(r, 120))
        }
      } else {
        // Kokoro unavailable — read the full text, then speak via the browser
        for (;;) {
          const { done, value } = await reader.read()
          if (done || token !== turnRef.current) break
          fullText += decoder.decode(value, { stream: true })
          setAiCaption(fullText)
        }
        if (token === turnRef.current && fullText && typeof window !== 'undefined' && window.speechSynthesis) {
          setVoiceState('speaking')
          await new Promise<void>((resolve) => {
            const u = new SpeechSynthesisUtterance(fullText)
            u.onend = () => resolve()
            u.onerror = () => resolve()
            window.speechSynthesis.speak(u)
          })
        }
      }
    } catch {
      // aborted (barge-in) or network failure — either way the loop continues
    } finally {
      if (abortRef.current === controller) abortRef.current = null
    }

    if (fullText.trim()) {
      historyRef.current.push({ role: 'assistant', content: fullText.trim() })
      useAppStore.getState().addMessage({ id: crypto.randomUUID(), sessionId, role: 'assistant', content: fullText.trim(), createdAt: new Date().toISOString() })
    }
    if (token === turnRef.current) setVoiceState('listening')
  }, [activeCourse, activeTopic, activeSlides, currentSlideIndex, drainAudioQueue, setVoiceState])

  // Live Whisper download progress in the header chip
  useEffect(() => onWhisperStatus((status, progress) => setWhisper({ status, progress })), [])

  // Mount: warm the models, start the VAD, run the loop until closed
  useEffect(() => {
    let disposed = false
    warmUpWhisper()
    void getKokoro()
    ;(async () => {
      try {
        const { MicVAD } = await import('@ricky0123/vad-web')
        const vad = await MicVAD.new({
          // Under a bundler there is no <script src> to derive asset paths
          // from, so the library defaults to fetching its model/worklet from
          // "/" (404). The model, worklet, and ORT wasm are self-hosted in
          // public/vad/ (copied from node_modules) — no CDN, no CORS.
          baseAssetPath: '/vad/',
          onnxWASMBasePath: '/vad/',
          // Slightly conservative thresholds: the tutor's own voice through
          // speakers must not trigger barge-in (echoCancellation helps too)
          positiveSpeechThreshold: 0.6,
          negativeSpeechThreshold: 0.35,
          minSpeechMs: 160,
          redemptionMs: 380,
          // Live mic meter: per-frame speech probability drives the UI bar,
          // so "is it hearing me?" is answered at a glance
          onFrameProcessed: (probs: { isSpeech: number }) => {
            if (!disposed) setVadLevel(probs.isSpeech)
          },
          onSpeechStart: () => {
            if (mutedRef.current) return
            // Barge-in: talking while the tutor speaks cuts it off
            if (stateRef.current === 'speaking' || stateRef.current === 'thinking') interrupt()
          },
          onSpeechEnd: (audio: Float32Array) => {
            if (mutedRef.current || disposed) return
            const st = stateRef.current
            if (st !== 'listening' && st !== 'speaking' && st !== 'thinking') return
            interrupt()
            setUserCaption('')
            setAiCaption('')
            setVoiceState('transcribing')
            void (async () => {
              const text = await transcribeAudio(audio)
              if (disposed) return
              if (text) void runTurn(text)
              else setVoiceState('listening')
            })()
          },
        })
        if (disposed) { vad.destroy(); return }
        vadRef.current = vad as unknown as MicVADInstance
        vad.start()
        setVoiceState('listening')
      } catch (err) {
        console.warn('[voice-mode] VAD failed to start:', err)
        setErrorMsg('Microphone or voice detection failed to start. Check mic permissions and try again.')
        setVoiceState('error')
      }
    })()
    return () => {
      disposed = true
      interrupt()
      vadRef.current?.destroy()
      vadRef.current = null
    }
  }, [interrupt, runTurn, setVoiceState])

  const toggleMute = () => {
    setMuted((m) => {
      mutedRef.current = !m
      if (!m) interrupt()
      return !m
    })
  }

  // Orb scale: expands with your voice while listening, pulses while it
  // speaks, breathes gently while thinking — rests otherwise
  const orbScale =
    state === 'listening' ? 1 + Math.min(vadLevel, 1) * 0.35
    : state === 'transcribing' ? 1.08
    : 1

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex flex-col items-center bg-background/95 backdrop-blur-xl p-6"
      role="dialog"
      aria-label="Voice conversation mode"
    >
      {/* Header */}
      <div className="flex w-full items-center justify-between">
        <p className="text-sm font-semibold text-muted-foreground">
          Voice Mode {activeCourse ? `· ${activeCourse.title}` : ''}
        </p>
        <button
          onClick={onClose}
          aria-label="Close voice mode"
          className="rounded-full p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Captions fill the middle; the orb lives low, ChatGPT-style */}
      <div className="flex w-full flex-1 flex-col items-center justify-end gap-5 pb-2">
        {state === 'error' && <p className="max-w-sm text-center text-xs text-red-500">{errorMsg}</p>}

        {/* Live captions: what it heard, and the reply as it streams */}
        <div className="min-h-24 max-w-xl space-y-3 text-center">
          {state === 'transcribing' && !userCaption && (
            <p className="text-sm text-muted-foreground italic">Transcribing what you said…</p>
          )}
          {userCaption && (
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold">You:</span> {userCaption}
            </p>
          )}
          {state === 'thinking' && !aiCaption && (
            <p className="text-sm text-muted-foreground italic">Thinking about it…</p>
          )}
          {aiCaption && (
            <p className="text-[15px] leading-relaxed">{aiCaption}</p>
          )}
        </div>

        {/* Whisper first-use download — the silent wait, made visible */}
        {whisper.status === 'loading' && (
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
            <Loader2 className="h-3 w-3 animate-spin" />
            Preparing speech recognition… {whisper.progress > 0 ? `${whisper.progress}%` : ''} (first use only)
          </span>
        )}
        {whisper.status === 'unavailable' && (
          <span className="rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs font-medium text-red-600">
            Speech recognition failed to load — check your connection and reopen
          </span>
        )}

        {/* The orb — ChatGPT-style gradient blob, low on the screen.
            Expands with your voice, pulses while speaking, rests otherwise. */}
        <motion.div
          animate={
            state === 'speaking'
              ? { scale: [1.02, 1.18, 1.06, 1.2, 1.02] }
              : state === 'thinking' || state === 'connecting'
                ? { scale: [1, 1.05, 1] }
                : { scale: orbScale }
          }
          transition={
            state === 'speaking'
              ? { repeat: Infinity, duration: 1.1, ease: 'easeInOut' }
              : state === 'thinking' || state === 'connecting'
                ? { repeat: Infinity, duration: 2.2, ease: 'easeInOut' }
                : { type: 'spring', stiffness: 260, damping: 18 }
          }
          className="relative mt-2 h-32 w-32 rounded-full"
          style={{
            background:
              'radial-gradient(circle at 32% 28%, #e0f2fe 0%, #93c5fd 26%, #60a5fa 45%, #818cf8 65%, #a78bfa 82%, #7c3aed 100%)',
            boxShadow: '0 0 60px 12px rgba(99, 102, 241, 0.35)',
          }}
        >
          {/* Slow-rotating sheen, like ChatGPT's blob */}
          <motion.div
            className="absolute inset-0 rounded-full opacity-60"
            style={{
              background:
                'conic-gradient(from 0deg, transparent 0%, rgba(255,255,255,0.35) 12%, transparent 30%, rgba(167,139,250,0.4) 55%, transparent 75%, rgba(125,211,252,0.4) 90%, transparent 100%)',
            }}
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 9, ease: 'linear' }}
          />
          {/* Outer glow breathes with activity */}
          <motion.div
            className="absolute -inset-5 rounded-full blur-2xl"
            style={{ background: 'radial-gradient(circle, rgba(96,165,250,0.5) 0%, rgba(139,92,246,0.25) 60%, transparent 100%)' }}
            animate={{ opacity: state === 'speaking' ? [0.4, 0.8, 0.4] : state === 'listening' ? 0.3 + vadLevel * 0.5 : [0.25, 0.4, 0.25] }}
            transition={state === 'listening' ? { duration: 0.1 } : { repeat: Infinity, duration: 1.6 }}
          />
          {(state === 'thinking' || state === 'transcribing' || state === 'connecting') && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-7 w-7 text-white/80 animate-spin" />
            </div>
          )}
        </motion.div>
        <p className="text-sm font-medium text-muted-foreground">{STATE_LABEL[state]}</p>

        {/* Live mic meter — fills while the VAD hears speech */}
        {state !== 'error' && state !== 'connecting' && (
          <div className="flex w-56 items-center gap-2">
            <Mic className={`h-3.5 w-3.5 shrink-0 ${vadLevel > 0.5 ? 'text-emerald-500' : 'text-muted-foreground/60'}`} />
            <div className="relative h-1.5 flex-1 rounded-full bg-muted/50 overflow-hidden">
              <div
                className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-100 ${vadLevel > 0.5 ? 'bg-emerald-500' : 'bg-sky-400/70'}`}
                style={{ width: `${Math.round(vadLevel * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 pb-4">
        <button
          onClick={toggleMute}
          aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}
          className={`flex h-14 w-14 items-center justify-center rounded-full border transition-colors ${
            muted ? 'border-red-500/50 bg-red-500/10 text-red-500' : 'border-border bg-muted/40 text-foreground hover:bg-muted'
          }`}
        >
          {muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </button>
        <button
          onClick={onClose}
          className="flex h-14 items-center rounded-full bg-red-500 px-6 text-sm font-semibold text-white hover:bg-red-600 transition-colors"
        >
          End
        </button>
      </div>
      <AnimatePresence />
    </motion.div>
  )
}
