# Synapse — Unified Architecture & Synchronized Implementation Plan

**Status: canonical.** This document supersedes `docs/synapse-architecture-and-roadmap.md` (the "new plan") and absorbs `docs/ROADMAP.md` + `docs/ARCHITECTURE.md` (the "old plan"). Nothing from either plan was dropped; every item is either **DONE**, merged into a unified component, or scheduled as a task in Part III.

Sources synchronized:
- OLD: `docs/ROADMAP.md` (Phases 0–4), `docs/ARCHITECTURE.md` (v2 Orchestrator), project memory/worklog (records what actually shipped through 2026-07-11).
- NEW: "AI prompt and system redesign" requirements doc (87 items, A1–A12 / B1–B16 / C1–C22 / D1–D37) + `docs/synapse-architecture-and-roadmap.md` (8-layer architecture, 90 tasks).
- Owner clarifications (2026-07-11): privacy-of-indexing rule, orchestrator system-intelligence rule, strategy-injection requirement (all encoded in §1 below).

---

# PART I — UNIFIED ARCHITECTURE

## 1. Governing rules (merged & clarified — these override everything else)

**R1 — Privacy split (old plan rule + new clarification).**
- Student *private learning content* (documents, slides, conversations, notes, quiz history, personal indexes, learning profile) NEVER enters our central database.
- It lives, in order of preference: learner's BYO database/storage (Phase-3 `byoSync.ts`, already shipped) → browser IndexedDB/localStorage (already shipped) → nothing.
- **Indexing is explicitly allowed and required** — coordinates, ALUs, sentence maps, TTS sync maps — but the index is *student data* and follows the same placement rule: BYO db if configured, else local. Indexing exists to power TTS slide reading, STT interruption, and spoken-content ↔ slide/paragraph sync. It is never a channel into our backend.
- Our shared DB (Turso) holds ONLY: system prompts/strategies, prompt tweaks, validated system intelligence, app config, opt-in anonymous leaderboard/presence.

**R2 — System Intelligence, strictly three-stage (new clarification, merges old "prompts in DB" + new "protected configuration" + "prompt improvement pipeline").**
The orchestrator may learn and store *system-level* intelligence only (prompt structures that work, generation strategies, formatting constraints, teaching-approach effectiveness, model behavior notes) — never user conversations or personal content. All writes flow through three separated stores:
1. `ai_suggestions` — anything a model proposes (prompt v2 beat v1, add constraint X). Models can ONLY write here.
2. `validated_improvements` — suggestions that passed code-level validation + (initially) human approval. Promotion is a controlled mechanism, never a model call.
3. Live strategy tables (`prompt_strategies`, `prompt_tweaks`) — what the composer actually reads. Updated only from stage 2.
Models never touch stages 2–3. Models hallucinate; the promotion gate is code.

**R3 — Strategy Injection (new requirement).**
Every generation request (questions, flashcards, notes, explanations, slides-derived content) is prompt-composed server-side: base task + injected proven structure, difficulty calibration, explanation style, formatting rules, quality constraints, learning-style adjustments — all read from the live strategy tables. "Generate questions about X" never goes out raw. This is the runtime consumer of R2 and the unification of old-plan "prompts + tweaks table the orchestrator loads by name" with new-plan "Master Prompt Upgrade (D37)".

**R4 — Nothing renders unvalidated** (old Phase 0.1, shipped; extended by new plan). Code-level validation between every model output and the user; retry-with-errors; corrupted/empty output never displayed or stored.

**R5 — One AI seam.** All model access behind `src/lib/ai.ts` (`LLM`), Hermes pluggable via env (shipped). The orchestrator, when built, sits behind the same seam. Nothing above it names providers.

**R6 — Silent by default.** Background generation, focus tracking, notes capture, formatting repair, strategy injection: invisible. Controls exist only where the user genuinely decides.

## 2. Component map (unified; ✅ = shipped per worklog/memory, ◐ = partial, ○ = to build)

### Layer A — AI Gateway & Orchestration
| Component | Status | Notes (what merged into what) |
|---|---|---|
| `LLM` seam, BYO OpenRouter key, free-model rotation + per-key circuit breaker, Pollinations fallback, streaming, Hermes env hook | ✅ | Old Phase 1 + new C21/C11 groundwork; `ai.ts`, `aiKey.ts` |
| Role-based Model Router (teacher/verifier/fast-helper/vision per old ARCHITECTURE.md; capability registry per new plan — same concept, **merged**) | ○ | JSON task-handoff schema with task, hints, retry policy, confidence |
| Orchestrator core (`/api/orchestrate`): classify → route → assemble; lesson progress; break/advance/quiz decisions | ◐ | Coach seam exists (`TutorCoach.tsx` — code-driven advance suggestions + break timer = the orchestrator's first decisions, already live); full router ○ |
| System Knowledge Pack (D27): generated app map loaded at orchestrator init | ○ | Build-step generated, not hand-written |
| Multi-orchestrator failover (D28): serialized state, rehydrate on context limit | ○ | State snapshot = lesson position + pending tasks + conversation digest (digest stays user-side per R1) |
| Review stage 2 (`chatWithReview`) | ✅ | Behind `AI_REVIEW=1`; orchestrator later owns the trigger policy |
| Identity firewall (B13) | ○ | Fixed persona; think-filter already live in `/api/chat` (old plan's cleanup pass — **merged** with new corruption layer below) |

### Layer B — System Intelligence (R2 + R3, new subsystem)
| Component | Status |
|---|---|
| `ai_suggestions` / `validated_improvements` / live strategy tables + promotion gate | ○ |
| Strategy Injection composer (server-side prompt assembly for ALL generation) | ○ |
| Master Prompt composition (D37): identity → formatting → persona → slide context → personalization (injected client-side from local profile, per R1) → boundaries | ◐ (9-layer prompt system exists in `prompts/index.ts`; restructure into composed layers reading strategy tables) |
| Outcome feedback loop: validation pass-rates per strategy version recorded (system-level metrics only) → suggestions | ○ |

### Layer C — Response Quality Pipeline (R4)
| Component | Status |
|---|---|
| Structural validator (`validate.ts`): schema, counts, meta-leak, dedup, per-type rules, `isRenderableQuestion` stale-sweep | ✅ |
| Retry-with-errors loop in `/api/questions` (+ regenerate) | ✅ |
| Stream watchdog (B8): inter-chunk timeout → cancel → clear message → inputs re-enabled | ○ |
| Corruption detector (B1): mojibake/broken dashes/truncation/token loops → repair or regenerate; **merged** with old think-filter/AI-ism cleanup (em-dash chains, meta-narration) which is ✅ | ◐ |
| Formatting normalizer (A1/B2) with before/after logging | ○ |
| Request state machine (B9): inputs disabled during response, guaranteed recovery | ◐ (partial in chat; formalize) |
| Prompt Improvement Pipeline (D29): failure analysis → refined prompt → retry; failures logged as suggestions (R2 stage 1) | ○ |

### Layer D — Document Pipeline (old Phase 4 + new C2–C10, **merged** — identical vision, new plan adds detail)
Upload (full format matrix: PDF/PPT/PPTX/DOC/DOCX/ODT/EPUB/HTML/TXT/MD/images/scans via LibreOffice, PyMuPDF, python-pptx, python-docx, Pandoc, ImageMagick) → Normalizer (page classification: title/course-info/lecturer/appendix/references/learning/summary/objectives; title-slide merging; original + compact + full index; positions preserved) → Structured Builder (stable IDs `page_12/paragraph_04`, coordinates) → Extraction (orchestrator decides OCR: PaddleOCR→Tesseract; vision: best free Qwen-VL/LLaVA/InternVL; formulas: Pix2Tex/LaTeX-OCR; speaker notes) → Indexing (object → page/position/size/section/topic/ALU — **stored per R1: BYO db else IndexedDB**) → ALU Builder (topic/definition/explanation/example/formula/images/practice/related/page-refs).
Status: ◐ upload+parse exists (mammoth etc., per-section splitting for generation shipped); everything from Normalizer onward ○.

### Layer E — Question Bank & Quiz (old + new **merged**; largely shipped)
| Component | Status |
|---|---|
| Background generation walking all sections, pause while tutoring, cache, dedup, cap 500, re-runnable | ✅ (`useBackgroundGeneration` + `questionCache.ts`) — new plan's A6/B4 |
| Shared pool Tutor↔Exam, retrieve-before-generate, unanswered-first rotation, answered-ids persistence | ✅ — new plan's A7 |
| Type diversity (MCQ/TF/fill-blank letter-boxes/matching) + per-type validation + strict type filters | ✅ — C13 (short-answer/practical types ○) |
| Per-section generation (115-slides problem), per-slide focus generation, More Questions continuation | ✅ — A5/A8/A9 baseline |
| Exam mode (fullscreen, presets, review, history), interactive flashcards, quiz resume (24h TTL), adaptive results | ✅ |
| Per-slide question bank formalization (slide ID + ALU ID + provenance on every question; today cache is per-course/section) | ○ — completes A8 |
| AI-initiated quiz navigation (A4): tutor tool-call → open quiz view initialized | ○ |
| Exam-mode course browser cards + search (D12), dashboard Quick Quiz direct launch (D35) | ○ |
| Image-based question generation via vision layer, graceful no-material explanation (B5/D36) | ○ |

### Layer F — Teaching Intelligence (old persona/simple-language + new A10–A12/B10/B16/D21–D24, **merged**)
Personas (professor/coach/friend/storyteller/relator) ✅ selector exists; calibrating onboarding (same hard topic in each voice, pick what clicked — old plan, kept) ○. Simple-vocabulary + everyday-analogy policy (old "native to my fellow Ghanaians" + new D23/D24 — same requirement, **merged**) ◐ in prompts, formalize as strategy-table entries. Slide-purpose awareness (A10) / topic anchoring (A11) / examinable-content focus (A12) / grounding + sentence-level coverage (D21/D22) / boundary control (B16) — all ○, all depend on Layer D classification. Context awareness (B10: repeated-question + struggle detection) ○. Slide-reference detection in chat ✅ (regex → [REFERENCED SLIDE] block). "next"/"n" advances slide ✅. Safe adaptation (D30/D32): per-user learning memory stays user-side (R1); only de-identified strategy effectiveness flows to `ai_suggestions` (R2). Orchestrator intent-catching (e.g. "press F5 to run" → offer mini test server — her declared next-phase item) ○.

### Layer G — Chat & Interaction UX
Shipped ✅: streaming, right-aligned user messages, hover toolbar fix, bubble overflow (wrap-anywhere, inner-scroll pre/table), copy/resend/recall on user messages, per-course chat resume + history dropdown + new-session, mobile slide overlay + hybrid drag divider, mobile mode selector, quick-actions three-dots, sidebar glitch fix, toasts top-center.
To build ○: full-width chat input (A2), desktop page-width messages (B3/A3), phone bubble-less AI messages (A3), always-visible AI-response actions (D18), scroll position persistence (B6), auto-scroll + scroll-to-bottom button (B7/D19), slide-nav freeze fix (B11), mobile nav-state store (B12), slide text-selection → Ask AI (D20).

### Layer H — Voice & Teaching Experience (old Phase 4 view + new C17–C19/C22, **merged**)
Teaching view v2: original slide left / generated explanation right, click-a-section-to-explain (old), highlight exact region via indexed coordinates + audio timestamps (both plans — identical vision). TTS: browser SpeechSynthesis first (old build-order, cheap win — one TTS exists in early worklog), then Kokoro/Piper/Coqui behind the seam. STT: browser SpeechRecognition first, Whisper later; interrupt-and-resume. Slide Player original/compact modes. Wake Lock + Media Session; PWA-first, native-iOS-ready (C22). All ○ except basic TTS ◐.

### Layer I — Profile, Focus, Notes, Gamification (new D1–D11 + old dashboard fix-list, **merged**)
Shipped ✅: dashboard responsive round (greeting, labels, resume rows), quiz header restructure + controls Sheet, Daily tab Focus-style, Question Map clamp, upload-page fixes, notes fixes from her bug list, break timer, streak basics, XP (`xp.ts`), real Recent Activity. 
To build ○: onboarding preferred-name (B15) + student card redesign (D2), profile/focus/leaderboard stat truth audits (D3/D4/D6/D10 — "real data or nothing"), global focus service surviving navigation (D7) + auto-start from tutoring (D8), streak freeze (D11), intelligent notes notebook Course→Topic→Slide (D9/C15), flashcard agent fields + stall recovery (C14/D15), share-progress + appearance stacking (D1/D5), upload name wrap (D16), quick-tips container (D17). All stats/notes/profile data stays user-side per R1.

## 3. Duplicate concepts — merged (explicit list)
1. Old "prompts+tweaks in DB" + new "Protected System Configuration (D31)" + new "Prompt Improvement Pipeline (D29)" + new "Master Prompt Upgrade (D37)" → **one System Intelligence subsystem** (Layer B, R2+R3).
2. Old "cleanup pass strips AI-isms / think-filter" + new "Corrupted Text Recovery (B1)" + new "Formatting Layer (B2/A1)" → **one Response Quality Pipeline** (Layer C).
3. Old role-router (teacher/verifier/helper/vision) + new capability-registry Model Router → **one router**, roles = capabilities.
4. Old ALU/coordinates/highlighting pipeline + new C3–C10/C19 → **one Document Pipeline + Teaching Experience** (identical vision; new plan supplies the missing detail: page classification, compact doc, formula layer, tool choices).
5. Old simple-language rule + new D23/D24 analogy/vocabulary policies → **one language policy**, stored as strategy entries so it's injectable (R3).
6. Old Hermes hook (shipped) + new C21/task-80 → **done**; remaining work is only the audit that nothing above the seam names providers.
7. New plan's "cloud storage for documents (D34)" **corrected** by old plan + R1 → BYO Cloudinary/db (creds browser-stored, shipped in Settings) — never our storage.
8. Old quiz-from-courses UX + new D36 exam-mode consistency → **merged** into the shared quiz-launch service task.

## 4. Gap analysis summary
- **In old plan, missing from new plan** (now preserved): persona-calibrating onboarding; click-a-section-to-explain; "explain like a friend" language DNA; open-source/self-host driver; browser-first TTS/STT stepping stone; intent-catching orchestrator behaviors; the entire shipped-feature reality (the new plan scheduled ~25 tasks' worth of already-done work).
- **In new plan, missing from old** (now added): page classification + compact document; formula layer; per-slide question banks with provenance; AI-initiated quiz navigation; stream watchdog/timeout; focus auto-tracking + global service; stat-truth audits; streak freeze; intelligent notes notebook; onboarding name; identity firewall; knowledge pack; multi-orchestrator failover; wake-lock/media-session; sentence-level coverage; boundary control.
- **Needed modification**: new plan's Turso-centric question bank and cloud document storage rewritten to respect R1 (BYO/local); new plan's "AI learns and updates prompts" rewritten as the three-stage R2 pipeline.

---

# PART II — IDENTIFIED CHANGES (line-by-line disposition)

Every numbered item of the new plan and every phase of the old plan has exactly one disposition:

**DONE (verified in code/memory):** A5(base), A6, A7, A8(base), A9(base), B5(partial-retry), B9(partial), B15-adjacent chat fixes, C13(4 of 6 types), C16-stage1, C21(hook), D13, D14, D15(partial), old-Phase-0 (all four), old-Phase-1, old-Phase-2, old-Phase-3(basic sync), streaming, her entire two-day bug list through Round N+4, coach seam, break timer.

**TO BUILD:** everything listed ○ above → becomes Part III tasks.

**REWRITTEN FOR PRIVACY (R1/R2):** A8-storage, D32, D34, C20-storage, D27/D28 state placement, question-bank placement, learning-memory placement.

**MERGED:** the 8 duplicate groups in §3.

**NOTHING REMOVED.** Items that look small (D16 name-wrap, D17 quick-tips border) are scheduled, not dropped.

---

# PART III — IMPLEMENTATION ROADMAP (46 tasks, 10 phases)

Priorities: **P0** = broken/blocking today, **P1** = foundation for later phases, **P2** = core feature, **P3** = enhancement. Build order follows: minor foundations → missing architecture pieces → medium features → orchestration → advanced intelligence.

## Phase 1 — Stability micro-foundations (all minor, no schema changes)
| # | Task | Description | Pri | Deps | Size |
|---|---|---|---|---|---|
| 1 | Stream watchdog | Inter-chunk timer on all streamed responses; stall → cancel, clear timeout message, inputs re-enabled. Kills every endless-buffer state (B8, B5, D15). | P0 | — | minor |
| 2 | Request state machine | Formalize idle→sending→streaming→done/failed store for chat/quiz/flashcards; send/resend/auto-send disabled while active; guaranteed return to idle (B9). | P0 | 1 | minor |
| 3 | Corruption detector | Extend live think-filter into full detector: mojibake, broken dashes, truncated markdown, token loops → repair or discard+retry (B1). | P1 | — | minor |
| 4 | Formatting normalizer | Meaning-preserving list/paragraph/spacing normalization post-response, with before/after log for review (A1, B2). | P1 | 3 | minor |
| 5 | Scroll suite | Per-conversation scroll persistence, auto-scroll after stream (respect user scroll-up), floating scroll-to-bottom button (B6, B7, D19). | P1 | — | minor |

## Phase 2 — Layout & identity polish (all minor)
| # | Task | Description | Pri | Deps | Size |
|---|---|---|---|---|---|
| 6 | Chat input full-width | Input uses all horizontal space minus actual button footprint; wrap before buttons (A2). | P1 | — | minor |
| 7 | Responsive message layout | Desktop: page-width conversation column (kill phantom container). Phone: bubble-less near-full-width AI messages, user messages distinct (A3, B3). | P1 | — | minor |
| 8 | Always-visible AI actions | Like/dislike/add-to-notes under every AI response, no hover, all devices (D18). User-message actions already shipped. | P2 | 7 | minor |
| 9 | Mobile nav-state store | Single source of truth: panel close restores chat mode, icons/indicator correct (B12); slide-nav non-blocking transitions (B11). | P1 | — | minor |
| 10 | Small-screen stacking pack | Appearance (D1), Share-Progress (D5) text-row-then-controls; Upload name wrap (D16); Quick-Tips border removal (D17). | P3 | — | minor |
| 11 | Onboarding name + student card | Collect preferred name, replace "Student" everywhere; card = email/name/plan one row, no "S" avatar, theme toggle kept (B15, D2). Name stored locally (R1). | P2 | — | minor |
| 12 | Identity firewall | Fixed "Synapse Tutor" persona; audit all prompts for provider/model leaks; output filter for self-disclosure (B13). | P1 | — | minor |

## Phase 3 — System Intelligence foundation (the R2/R3 subsystem)
| # | Task | Description | Pri | Deps | Size |
|---|---|---|---|---|---|
| 13 | Strategy schema (shared DB) | `prompt_strategies`, `prompt_tweaks`, `ai_suggestions`, `validated_improvements` tables. **Run `db:push` AND `db:push:prod`.** | P1 | — | minor |
| 14 | Prompt composer v2 | Restructure `prompts/index.ts` into layered composition (identity→formatting→persona→slide-context→personalization→boundaries) reading strategy tables with in-memory cache (D37; old build-order #3). | P1 | 13 | **major** |
| 15 | Strategy Injection | Every generation route composes: task + proven structure + difficulty + explanation style + formatting + quality constraints (R3). No raw prompts leave the server. | P1 | 14 | **major** |
| 16 | Suggestion → promotion gate | Models write `ai_suggestions` only; code-validated + human-approved promotion into live tables; audit trail (R2, D31). | P1 | 13 | minor |
| 17 | Outcome metrics loop | Record validation pass-rate per strategy version (system-level only); failures auto-file suggestions (D29 groundwork). | P2 | 15,16 | minor |

## Phase 4 — Question bank completion (medium)
| # | Task | Description | Pri | Deps | Size |
|---|---|---|---|---|---|
| 18 | Per-slide bank + provenance | Add slideId/ALU-ref/provenance/used-status to cached questions; per-slide (not just per-section) organization. Stored per R1 (IndexedDB/BYO). | P2 | — | minor |
| 19 | Shared quiz-launch service | One entry path for dashboard Quick Quiz (D35), exam mode, tutor-initiated; consistent no-material explanation (D36). | P2 | — | minor |
| 20 | AI-initiated quiz navigation | Tutor tool-call `startQuiz(slide, count, types)` → app routes to quiz initialized from bank (A4). | P2 | 19 | minor |
| 21 | Exam-mode course browser | Cards + search/filter like Courses page, replacing dropdown (D12). | P2 | — | minor |
| 22 | Remaining question types | short_answer + practical formats with validation rules (C13 completion). | P2 | 15 | minor |
| 23 | Vision-based question generation | Image/diagram slides route through vision model; graceful degradation (B5). | P2 | 31 | minor |

## Phase 5 — Document pipeline I: normalize & structure
| # | Task | Description | Pri | Deps | Size |
|---|---|---|---|---|---|
| 24 | Format-matrix upload | Full C2 matrix (LibreOffice/PyMuPDF/python-pptx/python-docx/Pandoc/ImageMagick) as async job with progress states. | P2 | — | **major** |
| 25 | Document Normalizer | Page classification (title/course-info/lecturer/appendix/references/learning/summary/objectives), title-slide merging, original+compact+index outputs, positions preserved (C3). | P1 | 24 | **major** |
| 26 | Structured Document Builder | Per-page typed objects with stable IDs and x/y/w/h coordinates (C4). | P1 | 25 | **major** |
| 27 | Index store (user-side) | Object→page/position/section/topic backlinks in IndexedDB/BYO db per R1 — powers highlighting + TTS sync (C9). | P1 | 26 | minor |

## Phase 6 — Document pipeline II: extraction intelligence
| # | Task | Description | Pri | Deps | Size |
|---|---|---|---|---|---|
| 28 | OCR layer | PaddleOCR primary, Tesseract fallback, only when no selectable text (C6). | P2 | 26 | minor |
| 29 | Formula layer | Pix2Tex/LaTeX-OCR for math/physics/chemistry/logic (C8). | P2 | 26 | minor |
| 30 | ALU Builder | Atomic Learning Units: topic/definition/explanation/example/formula/images/practice/related/page-refs (C10; old Phase 4). | P1 | 26,27 | **major** |
| 31 | Vision layer | Diagram/chart/drawing/handwriting understanding via best available free vision model, router-chosen (C7). | P2 | 26 | **major** |
| 32 | Slide Player dual mode | Original + Compact views (merged headers, faded/skipped non-teaching pages) (C18). | P2 | 25 | minor |

## Phase 7 — Orchestrator (major AI systems)
| # | Task | Description | Pri | Deps | Size |
|---|---|---|---|---|---|
| 33 | Role router | Capability registry + role assignment (teach/verify/fast/vision) from user's key; JSON handoff schema (task/hints/retry/confidence); fallback chains (old build-order #2 + new Model Router). | P1 | — | **major** |
| 34 | Orchestrator core `/api/orchestrate` | Classify → route → assemble → stream; owns retry policy and review-stage-2 triggers; absorbs TutorCoach decisions (breaks, advancement, when-to-quiz); intent-catching ("press F5" → offer test env). | P1 | 33,14 | **major** |
| 35 | System Knowledge Pack | Build-step-generated app map (pages/features/workflows) loaded at orchestrator init (D27). | P2 | 34 | minor |
| 36 | Orchestrator failover | Continuous state snapshot (conversation digest stays user-side per R1); context-limit detection; rehydrate-and-continue (D28). | P2 | 34 | **major** |
| 37 | Prompt Improvement Pipeline | On validation failure: analyze → refine prompt preserving intent → retry; pattern-file suggestions (D29, completes 17). | P2 | 34,17 | minor |

## Phase 8 — Teaching intelligence (advanced)
| # | Task | Description | Pri | Deps | Size |
|---|---|---|---|---|---|
| 38 | Slide-aware tutoring | Classification-driven depth (A10), topic/objective anchoring (A11), examinable-content focus (A12), grounding + sentence-level coverage tracking (D21/D22), boundary control (B16). | P1 | 25,30,34 | **major** |
| 39 | Language policy as strategies | Everyday-analogy + simple-vocabulary rules (D23/D24 + her language DNA) as injectable strategy entries. | P2 | 15 | minor |
| 40 | Persona system v2 | Calibrating onboarding (same hard topic in each voice, pick what clicked — old plan); persona preview after tweaks; all six styles (C12). | P2 | 14 | minor |
| 41 | Context awareness + safe adaptation | Repeated-question/struggle detection, follow-ups, weak-area focus (B10); per-user learning memory user-side (D32/D30); de-identified effectiveness → suggestions only (R2). | P2 | 34 | **major** |

## Phase 9 — Voice & teaching experience
| # | Task | Description | Pri | Deps | Size |
|---|---|---|---|---|---|
| 42 | Teaching view v2 | Original slide left / explanation right, click-a-section-to-explain, region highlighting from index coordinates synced to narration (old Phase 4 + C19). | P1 | 27,30,34 | **major** |
| 43 | TTS/STT ladder | Browser SpeechSynthesis/Recognition first (old build-order #6), then Kokoro/Piper/Coqui + Whisper behind the seam; interrupt-and-resume; speed/tone controls (C17). | P2 | 42 | **major** |
| 44 | Background experience | Screen Wake Lock during teaching; Media Session lock-screen controls; PWA-first, native-iOS-ready (C22). | P3 | 43 | minor |

## Phase 10 — Data truth, engagement & full validation
| # | Task | Description | Pri | Deps | Size |
|---|---|---|---|---|---|
| 45 | Stat-truth + engagement pack | Global focus service (D7) + auto-start from tutoring (D8) + real focus metrics (D6); profile/leaderboard audits — every stat live or removed (D3/D4/D10); Learning-Profile cleanup; streak freeze (D11); intelligent notes notebook Course→Topic→Slide (D9/C15); flashcard agent completion (C14); slide-selection→Ask-AI (D20). All user data local/BYO per R1. | P2 | 34 | **major** |
| 46 | Full system audit | New-plan Batch-9 audits (chat faults, quiz e2e, ingestion corpus, teaching quality, privacy isolation, stat math, voice/highlight, breakpoints, full journey); traceability sweep — every item of both plans demonstrably live or explicitly deferred with reason (D26). | P1 | all | **major** |

**Counts:** 46 tasks · 13 major / 33 minor · Phases 1–2 are pure minor-task stabilization (per the required ordering), 3–4 missing architecture, 5–6 medium pipeline, 7 orchestration, 8–10 advanced intelligence + validation.

**Critical-path chain:** 13 → 14 → 15 → 34 → 38 → 42 (strategy schema → composer → injection → orchestrator → slide-aware teaching → teaching view v2). Everything else parallelizes around it.

**Standing reminders:** every shared-DB schema change runs `db:push` + `db:push:prod`; quiz-emptiness class of bugs is guarded by validate.ts — extend it for every new generated type; the project must stay safe to open-source (R1 is non-negotiable).

**Pinned model choices (owner decision 2026-07-11):** all free/open models. Orchestrator/reasoning role: DeepSeek-R1 (free tier). Teaching role: openai/gpt-oss-120b:free. Fast helper: gpt-oss-20b-class free model. Vision/image extraction (task 23, 31): Qwen-VL → LLaVA → InternVL, router picks best available free one. TTS: Kokoro (primary) → Piper → Coqui, after browser SpeechSynthesis stepping stone. STT: Whisper, after browser SpeechRecognition stepping stone. The role router (task 33) encodes these as default role assignments, still overridable by availability probing.

---

# PART IV — OWNER CHANGE REQUESTS 2026-07-12 (tasks 57–78)

Source: Rebecca's consolidated change-request list (22 items). Numbering is CR *n* → task *56+n* — this matches the task-number comments already present in code (`task 57` in appStore/questionIntent/TutorView, `task 62` in answerCheck, `task 63` in localLibrary, `task 70` in TutorView). Per standing protocol these run in batches of ~10 with tsc+eslint+vitest validation between batches; bug-class items outrank the rest within their batch. All quiz/tutor state is user-side per R1; orchestrator state additions are client-held blobs per D28.

| # | Task (CR) | Description | Pri | Size |
|---|---|---|---|---|
| 57 | Tutor-driven quiz flow (CR1) | Tutor asks question count → redirects to Quiz page; quiz from current atomic unit ONLY; results shown; auto-return to originating tutor session; tutor bubble available during quiz; orchestrator knows tutor-initiated-quiz state (slide, questions, answers, mistakes, session); on finish tutor gets score/misses and offers review / re-explain / another quiz. | P1 | **major** |
| 58 | Manual quiz progression (CR2) | No auto-advance in Quiz Mode: show correctness + explanation, user presses Next. Flashcards KEEP auto-advance. | P1 | minor |
| 59 | Quiz black-screen fix (CR3) | Tutor-generated quiz renders immediately; never requires leave-and-return. | P1 | minor |
| 60 | Quiz results responsive grid (CR4) | Result buttons in two-column grid on small screens; no overflow/cut-off. | P1 | minor |
| 61 | AI assistant inside quiz (CR5) | Bubble always available; smooth animation + onboarding-style overlay; answers about current question with follow-up context; orchestrator knows slide + active question + query. | P1 | **major** |
| 62 | Semantic written-answer evaluation (CR6) | Typed answers judged by meaning, not exact match; key-ideas-present = correct; missing ideas explained. | P1 | minor |
| 63 | Meaningful-content question filter (CR7) | No questions from lecturer names, grading policy, admin/intro pages, decorations, metadata; only educational content. | P1 | minor |
| 64 | Tutor slide awareness (CR8) | Tutor always knows current atomic unit, current slide, total units; "Which slide are we on?" always correct. | P1 | minor |
| 65 | ALU cleaning & merge on ingest (CR9) | Auto-strip grading/requirements/welcome/admin/lecturer/intro pages; merge title page + following explanation into one atomic unit; teaching starts at first meaningful concept. | P1 | **major** |
| 66 | Tutor navigation (CR10) | Selecting a slide opens the tutor teaching that unit; "Next / Next slide / Continue" advances unit + updates context + explains immediately; no Explain button. | P1 | minor |
| 67 | Tutor context management (CR11) | Context updates on every unit change; "Explain this" = current unit; future-slide questions answered briefly + "covered later", no drift. | P1 | minor |
| 68 | Exact-count quiz generation (CR12) | Ask how many questions; generate exactly N, never more. | P1 | minor |
| 69 | Per-ALU background banks w/ priority interrupt (CR13) | 20–30 q/unit, ~200–250/course; bank-first serving; if short: pause background gen → finish requested unit → deliver → resume where stopped; never interferes with live quiz. | P1 | **major** |
| 70 | Unique quiz sessions (CR14) | Sessions tracked; completed stay completed; new quizzes get fresh sets; answered questions not reused unless explicit review. | P1 | minor |
| 71 | TTS voice manager in Settings (CR15) | Voice downloads in Settings: progress, ready state, selection, optional cloned voices; downloaded voices start instantly. | P2 | minor |
| 72 | Matching questions polish (CR16) | Post-submit correct/incorrect indication; aligned columns, consistent spacing, taller cards centred; remove redundant "matched" labels. | P2 | minor |
| 73 | Streak reward tiers + answer SFX (CR17) | Unique reward cards/animations/sounds per milestone (5, 10, higher); satisfying correct-answer sounds. | P2 | minor |
| 74 | Persistent focus session (CR18) | Focus session survives leave-and-return; focus state maintained app-wide (D7/D8 overlap). | P1 | minor |
| 75 | Remove hardcoded data (CR19) | Live updates for spaced repetition, active sessions, streaks, XP, weekly XP, achievements, leaderboard, courses completed, level, stats. | P1 | **major** |
| 76 | Progress tracking fix (CR20) | XP increases after learning activity; achievements unlock; course counts/levels/leaderboard update from real activity. | P1 | minor |
| 77 | Quiz entry behaviour (CR21) | Quiz page never auto-starts: choose course → choose quiz → background-prepared → load on selection. | P1 | minor |
| 78 | Orchestrator as system authority (CR22) | Orchestrator tracks course/unit/tutor-session/quiz-session/progress/mistakes/navigation/background-gen state; coordinates components; tutor does NOT control app logic; deterministic code governs critical behaviour; hallucination containment. | P1 | **major** |

**Part IV counts:** 22 tasks · 6 major / 16 minor. Batch order: **A (quiz core)** 58, 59, 60, 62, 63, 68, 72 → **B (tutor↔quiz loop)** 57, 61, 70, 77 → **C (ALU + navigation + orchestrator)** 64, 65, 66, 67, 69, 78 → **D (experience/stats)** 71, 73, 74, 75, 76.
