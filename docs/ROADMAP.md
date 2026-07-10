# SynapseLearn Roadmap

Guiding principle: **the platform stores nothing personal.** All learner content lives in the
learner's browser, or in cloud services *they* own and pay for (their OpenRouter key, their
database, their media storage). Our shared database holds only what the system itself needs:
prompts, configuration, and the opt-in anonymous leaderboard. This is what makes the project
safe to open-source and safe to self-host.

Second principle: **never let an LLM answer reach the user unchecked.** Generated quizzes,
flashcards, and structured output pass through a code-level validation layer (schema checks,
not an AI reviewer). Invalid output is retried with corrective feedback, never shown.

---

## Phase 0 — Micro fixes (current)

The small things that are broken today, fixed for good.

### 0.1 Output validation layer (`src/lib/validate.ts`)
Code-only guard between every model response and the user. For generated questions/flashcards:
- Every item must have non-empty `question`, `answer`, `explanation`.
- `multiple_choice` items: exactly 4 unique options; `answer` must be one of them.
- Reject items that echo the task or leak persona/meta text (e.g. "the user is a fast
  learner", "as an AI", "generate questions in this format", raw prompt fragments).
- Deduplicate repeated/near-identical questions.
- Retry loop: on validation failure, re-ask the model **with the specific validation errors
  appended** (up to 3 attempts). Only items that pass are saved. If fewer than 3 valid items
  survive, return a clear error — never store empty rows.
- Applied in both `/api/questions` (quiz mode) and the chat `\`\`\`quiz` block (tutor chat),
  so garbage can never reach the frontend from either path.

### 0.2 Data hygiene
- Delete existing empty/garbage question rows from the database (the source of "4 quizzes,
  all empty").

### 0.3 Quiz mode UX
- Quiz mode always offers existing My Courses content (picker already exists — make it the
  primary path; "upload new slides" is secondary, never a requirement).

### 0.4 Chat UI bugs
- User messages right-aligned from the moment they're sent (no center-then-shift).
- Hover toolbar leaves without the double-jump.
- Streaming layout: avatar/text anchored left while tokens stream in.

## Phase 1 — Bring-your-own OpenRouter key

- Settings page: learner pastes their own OpenRouter API key. Stored **only in the browser**
  (never in our database, never logged). Sent per-request in a header; the server uses it and
  forgets it.
- Clear rate-limit feedback: when their key returns 429, tell them it's their key's limit —
  wait for reset or swap keys.
- The server-side `OPENROUTER_API_KEY` env becomes an optional fallback for self-hosters,
  not a requirement.

## Phase 2 — Local-first learner data

- Courses, slides, notes, questions, quiz history, progress move to IndexedDB in the browser.
- The shared database keeps only: system prompts/config, and the opt-in anonymous
  presence/leaderboard heartbeat.
- Export/import: one file the learner can keep anywhere (notes app, drive) to move devices.

## Phase 3 — Bring-your-own cloud (cross-device without us)

- Settings accepts the learner's own database URL (Turso/Neon/…) and Cloudinary credentials,
  stored only in their browser. The app syncs their content to *their* infrastructure.
- New device: paste the same keys, everything is back. We never see the data.
- No keys set? Local-only mode keeps working, with the shared DB as an explicit opt-in
  convenience they can clear at any time once they migrate.

## Phase 4 — The orchestrator & document-to-teacher pipeline (the big jump)

- Orchestrator routes each task to a role-assigned model via the learner's OpenRouter key:
  teacher (strong general model), verifier (reasoning model for math/logic checks), fast
  helper (small model for routing/quick answers), vision (diagram understanding). No single
  model does everything; a JSON handoff schema carries task, hints, retry policy, confidence.
- Document pipeline: extract text/images/tables **with coordinates**, build Atomic Learning
  Units, index element positions so the frontend can highlight the exact slide region the
  tutor is talking about.
- Teaching view v2: original slide on the left, tutor's generated explanation on the right,
  TTS narration synchronized to slide highlights; STT for spoken questions.
- Token-by-token streaming everywhere (already partially in place in chat).
- Hermes agent hook: a defined endpoint/path where a cloud agent with richer tool access can
  be plugged in later without re-architecting.
