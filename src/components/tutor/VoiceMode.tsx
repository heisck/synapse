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
import { transcribeAudio, warmUpWhisper, onWhisperStatus, getWhisperStatus, nativeSpeechRecognitionSupported, type WhisperStatus } from '@/lib/voice/stt'
import { getKokoro, getSelectedVoice, resolveVoiceId, pickBestNativeVoice, isKokoroSynthKnownBad, markKokoroSynthStart, markKokoroSynthOk } from '@/lib/voice/tts'
import { piperSynthesize, isPiperDownloaded, warmUpPiper } from '@/lib/voice/piper'

type VoiceState = 'connecting' | 'listening' | 'transcribing' | 'thinking' | 'speaking' | 'error'

const STATE_LABEL: Record<VoiceState, string> = {
  connecting: 'Getting ready…',
  listening: 'Listening, just talk',
  transcribing: 'Heard you…',
  thinking: 'Thinking…',
  speaking: 'Speaking — interrupt any time',
  error: 'Voice mode unavailable',
}

/**
 * Show only the tail of a long live transcript so new words roll in and old
 * ones scroll out — one calm line that keeps up with a long utterance instead
 * of growing into a wall of text.
 */
function latestTranscript(text: string, max = 140): string {
  const t = text.trim()
  if (t.length <= max) return t
  const tail = t.slice(t.length - max)
  const sp = tail.indexOf(' ')
  return '…' + (sp > 0 ? tail.slice(sp + 1) : tail)
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
  // Gapless playback: every sentence's PCM is scheduled on ONE AudioContext
  // timeline, so consecutive sentences butt up with zero gap. (The old path —
  // a fresh `new Audio(blobUrl)` per sentence — hitched audibly between
  // sentences while each element decoded its blob and spun up.) Barge-in stops
  // every scheduled source at once.
  const audioCtxRef = useRef<AudioContext | null>(null)
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set())
  const nextStartRef = useRef(0)
  const playingRef = useRef(false)
  const stateRef = useRef<VoiceState>('connecting')
  const mutedRef = useRef(false)
  // Voice-mode conversation history (also mirrored into the tutor session)
  const historyRef = useRef<Array<{ role: 'user' | 'assistant'; content: string }>>([])

  const setVoiceState = useCallback((s: VoiceState) => {
    stateRef.current = s
    setState(s)
  }, [])

  const getAudioContext = useCallback(() => {
    const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
    const Ctor = w.AudioContext ?? w.webkitAudioContext
    if ((!audioCtxRef.current || audioCtxRef.current.state === 'closed') && Ctor) {
      audioCtxRef.current = new Ctor()
    }
    // Voice mode opens on a tap, so resuming a suspended context is allowed.
    if (audioCtxRef.current?.state === 'suspended') void audioCtxRef.current.resume()
    return audioCtxRef.current
  }, [])

  const stopPlayback = useCallback(() => {
    playingRef.current = false
    nextStartRef.current = 0
    for (const src of sourcesRef.current) {
      try { src.onended = null; src.stop() } catch { /* already ended */ }
    }
    sourcesRef.current.clear()
  }, [])

  /** Cuts everything belonging to the current turn (barge-in or close). */
  const interrupt = useCallback(() => {
    turnRef.current++
    abortRef.current?.abort()
    abortRef.current = null
    stopPlayback()
  }, [stopPlayback])

  /** Schedules one synthesized sentence on the shared timeline, gaplessly. */
  const enqueueAudioChunk = useCallback((raw: { audio: Float32Array | Float32Array[]; sampling_rate: number }, token: number) => {
    if (token !== turnRef.current) return
    const ctx = getAudioContext()
    if (!ctx) return
    const samples = Array.isArray(raw.audio) ? raw.audio[0] : raw.audio
    if (!samples || samples.length === 0) return
    const buf = ctx.createBuffer(1, samples.length, raw.sampling_rate)
    buf.getChannelData(0).set(samples)
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(ctx.destination)
    // Start exactly where the previous sentence ends (or now +20ms so we never
    // schedule in the past) — consecutive sentences play as one seamless breath.
    const startAt = Math.max(ctx.currentTime + 0.02, nextStartRef.current)
    src.start(startAt)
    nextStartRef.current = startAt + buf.duration
    playingRef.current = true
    sourcesRef.current.add(src)
    src.onended = () => {
      sourcesRef.current.delete(src)
      if (sourcesRef.current.size === 0) playingRef.current = false
    }
  }, [getAudioContext])

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

      // On iOS, once Kokoro's synth has crashed the tab we never try it again —
      // fall to Piper (lighter, stable ORT). Warm it in the background so it's
      // ready even before its Settings download if the learner hasn't fetched it.
      const skipKokoro = isKokoroSynthKnownBad()
      if (skipKokoro && !isPiperDownloaded()) warmUpPiper()
      const kokoro = skipKokoro ? null : await getKokoro()
      const voice = resolveVoiceId(getSelectedVoice())
      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      if (kokoro) {
        // Sentence-streamed synthesis: LLM tokens feed the splitter, kokoro
        // yields per-sentence audio, the queue plays as it fills. Arm the crash
        // breadcrumb around it — if the tab dies here, next load routes to Piper.
        markKokoroSynthStart()
        const { TextSplitterStream } = await import('kokoro-js')
        const splitter = new TextSplitterStream()
        const synthesis = (async () => {
          for await (const chunk of kokoro.stream(splitter, { voice })) {
            if (token !== turnRef.current) break
            markKokoroSynthOk() // first chunk back = this device's Kokoro synth works
            enqueueAudioChunk(chunk.audio as unknown as { audio: Float32Array | Float32Array[]; sampling_rate: number }, token)
            if (stateRef.current !== 'speaking' && token === turnRef.current) setVoiceState('speaking')
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
        // Wait for the scheduled audio timeline to finish playing out
        while (token === turnRef.current && audioCtxRef.current && audioCtxRef.current.currentTime < nextStartRef.current) {
          await new Promise((r) => setTimeout(r, 80))
        }
      } else if (isPiperDownloaded()) {
        // Piper fallback: synthesize sentence-by-sentence as the reply streams,
        // decode each WAV to PCM, and schedule it on the same gapless timeline.
        const ctx = getAudioContext()
        let pending = ''
        let chain = Promise.resolve()
        const synthSentence = (s: string) => {
          chain = chain.then(async () => {
            if (token !== turnRef.current || !ctx) return
            const blob = await piperSynthesize(s)
            if (!blob || token !== turnRef.current) return
            try {
              const decoded = await ctx.decodeAudioData(await blob.arrayBuffer())
              enqueueAudioChunk({ audio: decoded.getChannelData(0), sampling_rate: decoded.sampleRate }, token)
              if (stateRef.current !== 'speaking' && token === turnRef.current) setVoiceState('speaking')
            } catch { /* decode failed — skip this sentence */ }
          })
        }
        const drain = (final: boolean) => {
          const re = /[^.!?]*[.!?]+/g
          let m: RegExpExecArray | null
          let lastIdx = 0
          while ((m = re.exec(pending))) {
            const s = m[0].trim()
            if (s) synthSentence(s)
            lastIdx = re.lastIndex
          }
          pending = pending.slice(lastIdx)
          if (final && pending.trim()) { synthSentence(pending.trim()); pending = '' }
        }
        for (;;) {
          const { done, value } = await reader.read()
          if (done || token !== turnRef.current) break
          const text = decoder.decode(value, { stream: true })
          fullText += text
          setAiCaption(fullText)
          pending += text
          drain(false)
        }
        drain(true)
        await chain
        while (token === turnRef.current && audioCtxRef.current && audioCtxRef.current.currentTime < nextStartRef.current) {
          await new Promise((r) => setTimeout(r, 80))
        }
      } else {
        // No on-device engine — read the full text, then speak via the browser
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
            const nv = pickBestNativeVoice()
            if (nv) u.voice = nv
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
  }, [activeCourse, activeTopic, activeSlides, currentSlideIndex, enqueueAudioChunk, getAudioContext, setVoiceState])

  // Release the AudioContext when voice mode closes
  useEffect(() => () => {
    try { void audioCtxRef.current?.close() } catch { /* already closed */ }
    audioCtxRef.current = null
  }, [])

  // Live Whisper download progress in the header chip
  useEffect(() => onWhisperStatus((status, progress) => setWhisper({ status, progress })), [])

  // The orb must react to your VOICE, not to STT or the API. On the native
  // SpeechRecognition path (Chrome/Edge/Android) the orb used to grow ONLY when
  // SR returned interim text — but SR transcription is cloud-based, so if it was
  // slow or offline the orb sat dead even though the mic was working fine (the
  // "I'm talking and the orb does nothing on my laptop" bug). Drive it from a
  // raw mic-level meter (AnalyserNode) instead, so it always responds live.
  // (The VAD path — iOS/Firefox — already meters the mic via onFrameProcessed.)
  useEffect(() => {
    if (!nativeSpeechRecognitionSupported()) return
    let raf = 0
    let stream: MediaStream | null = null
    let src: MediaStreamAudioSourceNode | null = null
    let disposed = false
    let last = 0
    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
        if (disposed) { stream.getTracks().forEach((t) => t.stop()); return }
        const ctx = getAudioContext()
        if (!ctx) return
        src = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 512
        analyser.smoothingTimeConstant = 0.85
        src.connect(analyser)
        const data = new Uint8Array(analyser.frequencyBinCount)
        const tick = () => {
          if (disposed) return
          raf = requestAnimationFrame(tick)
          const now = performance.now()
          if (now - last < 33) return // ~30fps: smooth without flooding React with re-renders
          last = now
          analyser.getByteTimeDomainData(data)
          let sum = 0
          for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v }
          const rms = Math.sqrt(sum / data.length)
          // Speech RMS (~0.015..0.25) → 0..1 with a small noise floor so silence rests the orb.
          setVadLevel(mutedRef.current ? 0 : Math.min(1, Math.max(0, (rms - 0.015) * 7)))
        }
        tick()
      } catch { /* mic blocked — the SpeechRecognition path surfaces the permission error */ }
    })()
    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      try { src?.disconnect() } catch { /* already gone */ }
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [getAudioContext])

  // Mount: start the conversation loop until closed.
  // Preferred ears: the browser's NATIVE SpeechRecognition (Chrome/Edge/
  // Android) — instant, no download, live interim transcripts. Fallback:
  // Silero VAD + local Whisper for browsers without it (Firefox).
  const srRef = useRef<{ stop: () => void } | null>(null)
  useEffect(() => {
    let disposed = false
    void getKokoro()

    if (nativeSpeechRecognitionSupported()) {
      type SRResultEvent = { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }
      const SRCtor = (window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown })
        .SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition
      // Microtask keeps setState out of the synchronous effect body
      queueMicrotask(() => {
      if (disposed) return
      try {
        const rec = new SRCtor!() as {
          continuous: boolean; interimResults: boolean; lang: string
          onresult: ((e: SRResultEvent) => void) | null
          onerror: ((e: { error?: string }) => void) | null
          onend: (() => void) | null
          start: () => void; stop: () => void; abort: () => void
        }
        rec.continuous = true
        rec.interimResults = true
        rec.lang = 'en-US'
        let active = true
        rec.onresult = (e) => {
          if (mutedRef.current || disposed) return
          let interim = ''
          let final = ''
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const r = e.results[i]
            if (r.isFinal) final += r[0].transcript
            else interim += r[0].transcript
          }
          // Barge-in: real words while the tutor talks/thinks cut it off
          if ((interim.trim().length > 3 || final.trim()) && (stateRef.current === 'speaking' || stateRef.current === 'thinking')) {
            interrupt()
            setVoiceState('listening')
          }
          if (interim.trim()) {
            setUserCaption(interim.trim()) // LIVE transcription as you speak
          }
          const finalText = final.trim()
          if (finalText) {
            void runTurn(finalText)
          }
        }
        rec.onerror = (e) => {
          // 'no-speech'/'aborted' are routine in continuous mode — onend restarts
          if (e?.error === 'not-allowed' && !disposed) {
            setErrorMsg('Microphone permission was denied. Allow the mic and reopen voice mode.')
            setVoiceState('error')
            active = false
          }
        }
        rec.onend = () => {
          // Continuous recognition times out periodically — keep it alive
          if (active && !disposed) {
            try { rec.start() } catch { /* already restarting */ }
          }
        }
        rec.start()
        srRef.current = { stop: () => { active = false; try { rec.abort() } catch { /* gone */ } } }
        setVoiceState('listening')
      } catch (err) {
        console.warn('[voice-mode] native SpeechRecognition failed:', err)
        setErrorMsg('Speech recognition failed to start. Check mic permissions and try again.')
        setVoiceState('error')
      }
      })
      return () => {
        disposed = true
        interrupt()
        srRef.current?.stop()
        srRef.current = null
      }
    }

    // ── Fallback path: Silero VAD + local Whisper ──
    warmUpWhisper()
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
          // End-of-turn silence before we treat you as done. 300ms responds
          // noticeably quicker than the old 380 without clipping natural
          // mid-sentence pauses (below ~250 starts cutting hesitant speakers).
          redemptionMs: 300,
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
    const next = !mutedRef.current
    mutedRef.current = next
    setMuted(next)
    if (next) {
      // Muting: cut any in-flight reply and actually stop listening — pause the
      // VAD so the mic goes cold (the native-SpeechRecognition path is gated by
      // mutedRef in its handler). Rest the orb.
      interrupt()
      vadRef.current?.pause()
      setVadLevel(0)
    } else {
      // Unmuting: resume detection.
      vadRef.current?.start()
    }
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

        {/* Live captions. No "You:", no "Transcribing…/Thinking…" filler — the
            orb itself shows you're heard and that it's working. While you talk,
            only the LATEST words show (they roll forward); once the reply starts
            streaming it takes over. */}
        <div className="min-h-24 max-w-xl space-y-3 text-center">
          {userCaption && !aiCaption && (
            <p className="text-sm text-muted-foreground">{latestTranscript(userCaption)}</p>
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
          {/* Rotating sheen. Idles slowly; while SPEAKING it sweeps fast so the
              gradient visibly flows as the tutor talks (state #1). */}
          <motion.div
            className="absolute inset-0 rounded-full opacity-60"
            style={{
              background:
                'conic-gradient(from 0deg, transparent 0%, rgba(255,255,255,0.35) 12%, transparent 30%, rgba(167,139,250,0.4) 55%, transparent 75%, rgba(125,211,252,0.4) 90%, transparent 100%)',
            }}
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: state === 'speaking' ? 2.4 : 9, ease: 'linear' }}
          />
          {/* Outer glow breathes with activity */}
          <motion.div
            className="absolute -inset-5 rounded-full blur-2xl"
            style={{ background: 'radial-gradient(circle, rgba(96,165,250,0.5) 0%, rgba(139,92,246,0.25) 60%, transparent 100%)' }}
            animate={{ opacity: state === 'speaking' ? [0.4, 0.8, 0.4] : state === 'listening' ? 0.3 + vadLevel * 0.5 : [0.25, 0.4, 0.25] }}
            transition={state === 'listening' ? { duration: 0.1 } : { repeat: Infinity, duration: 1.6 }}
          />
          {/* Thinking/transcribing: NO spinner (state #2). A distinct fast
              counter-rotating gradient band reads as "working" without the
              literal loader, and looks different from the speaking sweep. */}
          {(state === 'thinking' || state === 'transcribing' || state === 'connecting') && (
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  'conic-gradient(from 90deg, rgba(96,165,250,0) 0%, rgba(167,139,250,0.65) 20%, rgba(96,165,250,0) 45%, rgba(129,140,248,0.65) 70%, rgba(96,165,250,0) 100%)',
                mixBlendMode: 'screen',
              }}
              animate={{ rotate: -360 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
            />
          )}
        </motion.div>
        {/* Status is shown by the orb itself now — keep the label for screen
            readers only (sr-only), so blind users still hear the state change. */}
        <p className="sr-only" aria-live="polite">{STATE_LABEL[state]}</p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 pb-4 mt-10">
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
