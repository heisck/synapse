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
import { transcribeAudio, warmUpWhisper } from '@/lib/voice/stt'
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

  const orbColor =
    state === 'speaking' ? 'from-emerald-400 to-teal-500'
    : state === 'thinking' || state === 'transcribing' ? 'from-amber-400 to-orange-500'
    : state === 'error' ? 'from-red-400 to-rose-500'
    : 'from-sky-400 to-indigo-500'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex flex-col items-center justify-between bg-background/95 backdrop-blur-xl p-6"
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

      {/* Orb */}
      <div className="flex flex-col items-center gap-6">
        <motion.div
          animate={
            state === 'speaking'
              ? { scale: [1, 1.12, 1.04, 1.15, 1] }
              : state === 'listening'
                ? { scale: [1, 1.05, 1] }
                : { scale: 1 }
          }
          transition={{ repeat: Infinity, duration: state === 'speaking' ? 1.2 : 2.4, ease: 'easeInOut' }}
          className={`relative h-36 w-36 rounded-full bg-linear-to-br ${orbColor} shadow-2xl`}
        >
          <motion.div
            className={`absolute -inset-4 rounded-full bg-linear-to-br ${orbColor} opacity-25 blur-2xl`}
            animate={{ opacity: state === 'speaking' ? [0.2, 0.45, 0.2] : [0.15, 0.3, 0.15] }}
            transition={{ repeat: Infinity, duration: 1.8 }}
          />
          {(state === 'thinking' || state === 'transcribing' || state === 'connecting') && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-white/80 animate-spin" />
            </div>
          )}
        </motion.div>
        <p className="text-sm font-medium text-muted-foreground">{STATE_LABEL[state]}</p>
        {state === 'error' && <p className="max-w-sm text-center text-xs text-red-500">{errorMsg}</p>}

        {/* Captions */}
        <div className="min-h-24 max-w-xl space-y-3 text-center">
          {userCaption && (
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold">You:</span> {userCaption}
            </p>
          )}
          {aiCaption && (
            <p className="text-[15px] leading-relaxed">{aiCaption}</p>
          )}
        </div>
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
