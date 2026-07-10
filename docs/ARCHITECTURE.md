# SynapseLearn — Target Architecture (v2 "Orchestrator")

This is the plan for the next version of the tutor system. The current tutor
(chat + slides + quiz protocol) stays as **v1** and keeps working while v2 is
built next to it.

## The big idea

One **orchestrator** sits between the user and the models. It never teaches by
itself — it looks at what came in (a slide deck, a question, a quiz request),
decides which specialist model should handle it, and assembles the result.

```
user ──▶ orchestrator ──▶ extractor      (pull text/structure out of slides)
                     ├──▶ classifier     (what IS this block: formula? diagram? prose?)
                     ├──▶ vision model   (describe images/diagrams, guide layout)
                     ├──▶ math model     (formula-heavy content)
                     ├──▶ tutor model    (the voice the learner hears, persona applied)
                     ├──▶ TTS / STT      (read aloud, voice input)
                     └──▶ database       (prompts, tweaks, general app data)
```

## Model access — user's own OpenRouter key

- Settings gets an **"AI Models"** section where the user pastes their own
  OpenRouter API key. It is stored in their browser (localStorage), sent only
  with their own requests, never persisted server-side.
- The system picks the models for each role automatically from what the key
  can access (extraction, vision, math, tutoring). We stop shipping model
  lists in `.env` — the env fallback stays only as the free default when no
  key is entered.
- If the user's key hits its rate limit, tell them plainly ("your key is
  rate-limited, wait for the reset or swap the key") and fall back to the
  free rotation meanwhile.

## What the database is for (and NOT for)

- **In**: system prompts and prompt "tweaks" the orchestrator loads by name,
  everyday app data (courses, slides, questions, presence).
- **Out**: personas, tutors, per-user learning data. Those live in the user's
  browser. Nobody needs personas in the database.
- Because every orchestrator call starts from a blank context, the prompts +
  tweaks table is how a fresh call "remembers" how this app wants things
  done. The orchestrator reads what it needs per request (e.g. what
  "explain" means here) instead of us re-teaching it in every prompt.

## The v2 teaching surface

- **Left side**: the ORIGINAL slide (the real render, not extracted text).
- **Right side**: whatever the model generates — a card, text, a drawing.
- The model explains block by block. The learner clicks a section of the
  slide; the tutor explains that section. Highlights/boxes/lines on the slide
  are guided by the vision model (so boxes land on the right spot, not where
  a text-only model guesses).
- Responses **stream token by token** (already live in v1 as of this change).
- Language stays simple — plain words, short sentences, examples first
  ("with your iPhone, ..."), like a friend explaining. This is enforced in
  the system prompt and in the persona/mood tweaks.
- A cleanup pass strips AI-isms before display: em-dash chains, "let me first
  check your profile" meta-narration, `<think>` blocks (the think-filter is
  already live in `/api/chat`).

## Onboarding that actually calibrates

- Pick a genuinely hard topic, show the SAME explanation in each persona's
  voice (professor / coach / friend / storyteller / relator), and ask which
  one clicked. That choice — not a checkbox — sets the persona.
- After a mood/persona tweak, show a quick "here's how I'd explain X now"
  example so the user sees what changed before confirming.

## Hermes agent hook (future)

- Keep one narrow, versioned entry point (`/api/agent`) where a hosted agent
  can later be plugged in for paying users. It identifies itself first, gets
  the same context injection (soul/memory/env) every time, and can be
  re-routed without touching the rest of the app.
- Until that exists, the orchestrator plays this role in-process.

## Build order

1. **Settings → OpenRouter key** (browser-stored) + key health check.
2. **Orchestrator route** (`/api/orchestrate`): classify request → route to
   role models → stream result. Fallback chain per role.
3. **Prompts in DB**: move system prompts/tweaks into the database with a
   seed script; orchestrator loads by name with an in-memory cache.
4. **v2 tutor surface**: original slide left, generated content right,
   click-a-section-to-explain.
5. **Vision guidance**: slide screenshots → vision model → highlight/box
   coordinates.
6. **TTS/STT**: browser SpeechSynthesis/Recognition first (free), hosted
   models (Coqui-XTTS etc.) behind the same orchestrator role later.
7. **`/api/agent`** stub for the Hermes hook.
