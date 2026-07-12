# Synapse — System Architecture & Implementation Roadmap

Source: "AI prompt and system redesign" document (4 sections, 87 numbered requirements: A1–A12 formatting/quiz behavior, B1–B16 reliability/UX, C1–C22 platform architecture, D1–D37 polish/validation/governance). Every requirement is mapped below; the traceability matrix at the end confirms coverage. Requirement D25 (generate ~50-task roadmap, execute in validated batches) is satisfied by this document's Part II.

---

# PART I — SYSTEM ARCHITECTURE

## Design principles

1. **One AI seam.** Everything talks to an `AIService` interface; OpenRouter (user-supplied keys) is one implementation behind it. Swapping in Hermes later touches nothing above the seam (C21).
2. **Silent by default.** Background generation, focus tracking, notes capture, formatting repair, retries — all invisible. UI controls exist only where the user genuinely decides something (per the "no unnecessary buttons" directive).
3. **Nothing renders unvalidated.** Every model output passes through the Response Quality Pipeline before the user sees it.
4. **Slide is the source of truth.** All teaching, questions, notes, and highlights trace back to indexed document objects (C9).
5. **Real data or nothing.** No placeholder metrics anywhere; a stat either reads live data or is removed (D3, D4, D6, D10).

## Layer 1 — AI Gateway & Orchestration Core
*(C11, C21, D27, D28, D31, B13)*

- **`AIService` interface**: `chat()`, `stream()`, `generateStructured(schema)`, `vision()`, `transcribe()`, `speak()`. OpenRouter adapter now; Hermes adapter later. Nothing above this layer imports provider SDKs or model names.
- **Model Router**: capability registry (reasoning / vision / formula / cheap-bulk), free-model availability probing, per-user OpenRouter key management, automatic fallback ordering.
- **Orchestrator** (the brain): selects model + prompt + tool per task; retries with backoff; reviews quality (Review Layer stage 2); tracks lesson progress; decides breaks, ALU advancement, and when to quiz the student. Loads a **System Knowledge Pack** at init — a generated map of every page, feature, and workflow in the app (D27) — kept fresh by a build step, not hand-maintained.
- **Multi-orchestrator failover** (D28): orchestrator state (lesson position, pending tasks, conversation digest) is serialized continuously; when context limits or unavailability hit, a fresh orchestrator instance rehydrates from the snapshot and continues mid-conversation. From the user's view: nothing happened.
- **Identity firewall** (B13): system prompts define a fixed app persona ("Synapse Tutor"); a prompt-audit checklist plus an output filter that catches provider/model self-disclosure. Identity questions get one consistent canned framing.
- **Protected configuration** (D31): the orchestrator can *propose* prompt/config improvements into a suggestions table; nothing is applied without explicit human validation. AI has zero write access to system prompts or config rows.

## Layer 2 — Response Quality Pipeline
*(A1, B1, B2, B5, B8, C16, D29)*

Every response, streaming or not, flows through:

1. **Stream watchdog** (B8): inter-chunk timer; if chunks stop arriving past threshold, cancel, show a clear timeout message, re-enable inputs. No endless spinners anywhere.
2. **Corruption detector** (B1): flags mojibake, invalid unicode runs, broken line-dashes, truncated markdown, repeated-token loops. Minor issues → repaired; severe → response discarded and regenerated. Corrupt text never reaches the chat.
3. **Formatting normalizer** (A1, B2): normalizes lists, paragraph spacing, heading levels, code fences — meaning-preserving. Before/after pairs are logged so we can review whether the model "did the right thing" and feed the prompt-improvement loop.
4. **Structural validator** (C16 stage 1, software-only): JSON schema conformance, required fields, question counts, non-empty content. This is the layer that catches the quiz-emptiness bug class permanently.
5. **Quality review** (C16 stage 2): only on validation failure or low-confidence output, the orchestrator reviews and either repairs or triggers regeneration.
6. **Prompt Improvement Pipeline** (D29): on failure, analyze *why* (which validator, what pattern), synthesize a refined prompt preserving original intent, retry. Failure patterns are recorded as suggestions (never auto-applied — D31, D30).

## Layer 3 — Document Ingestion Pipeline
*(C2–C10, D34)*

Upload → Normalize → Structure → Extract → Index → ALU.

- **Upload layer** (C2): PDF, PPT/PPTX, DOC/DOCX, ODT, EPUB, HTML, TXT, MD, PNG/JPG/JPEG, scans. Tools: LibreOffice (office→PDF), PyMuPDF, python-pptx, python-docx, Pandoc, ImageMagick. Runs as an async job with progress states — never blocks the UI.
- **Document Normalizer** (C3): detects type; converts to one internal format; classifies every page (title / course-info / lecturer / appendix / references / learning / summary / objectives); merges title-only slides into their section; emits **original** (untouched), **compact** (teaching-only), and **full index**, preserving every position on every page.
- **Structured Document Builder** (C4): per page — number, original, compact, paragraphs, bullets, images, tables, formulas, code, headings, each with a stable ID (`page_12/paragraph_04`) and coordinates (x, y, w, h).
- **Extraction layer** (C5): text, images, tables, charts, formulas, code, links, speaker notes. The orchestrator decides per-page whether OCR or vision is needed.
- **OCR layer** (C6): only when no selectable text. PaddleOCR primary, Tesseract fallback.
- **Vision layer** (C7): diagrams, charts, biology/engineering drawings, maps, flowcharts, handwriting — via the best available free OpenRouter vision model (Qwen-VL / LLaVA / InternVL), chosen dynamically by the router.
- **Formula layer** (C8): Pix2Tex / LaTeX-OCR for math, physics, chemistry, logic.
- **Indexing layer** (C9): every extracted object → page, position, size, parent section, topic, ALU. This is what powers frontend highlighting and slide-grounded teaching.
- **ALU Builder** (C10): Atomic Learning Units — topic, definition, explanation, example, formula, images, practice, related ALUs, original page refs. The teaching foundation.
- **Storage** (D34, D33): originals + derived artifacts in cloud object storage (guided setup if needed); browser storage reserved strictly for lightweight personalization and progress — never documents.

## Layer 4 — Question Bank & Quiz System
*(A4–A9, B4, B5, C13, D12, D13, D35, D36)*

- **Per-slide question bank** (A8): every question row carries slide ID, ALU ID, format, difficulty, provenance, and used/unused status. Large banks per slide enable repeated practice without exhaustion.
- **Shared pool** (A7): Tutor and Exam modes read/write the *same* bank. Exam mode consumes existing unused questions first, generates only to fill gaps (no regeneration waste), and both modes stay synchronized.
- **Background generator** (A6, B4): while the student studies a slide, a low-priority worker generates questions for it. **Pauses whenever the AI is responding** to the user (single request pipe discipline), resumes after; per-slide cache cap is configurable. Entirely silent — no UI.
- **Flexible counts** (A5): no hard limit; user (or AI) requests quick quiz or a large set; count is a parameter validated by the structural validator.
- **All formats** (C13): MCQ, true/false, fill-in-the-blank, short answer, practical.
- **AI-initiated navigation** (A4): the tutor has a `startQuiz(slideId, count, formats)` tool. When invoked, the app routes to the quiz view and initializes it from the bank instantly — no manual navigation.
- **Continuation** (A9): finishing a set offers "practice this slide again" pulling unused bank questions; never auto-advances the slide.
- **Consistency** (D36, D35, B5): every quiz entry point (dashboard Quick Quiz, Exam mode, AI-initiated) uses one shared quiz-launch service. Quick Quiz launches immediately with no intermediate prompts. If no material exists, a clear explanation is shown — never a stuck buffer. Image-based generation routes through the vision layer with graceful degradation.
- **Session restoration** (D13): active quiz state persisted; returning to Exam mode restores it.
- **Course selection** (D12): card-based course browser with search/filter, mirroring the Courses page, replacing the dropdown.

## Layer 5 — Teaching Intelligence & Prompt System
*(A10–A12, B10, B16, C12, D21–D24, D30, D32, D37)*

- **Layered Master Prompt** (D37): composed at request time from — core identity & philosophy → formatting standards → teaching style preset → slide context (purpose, topic, ALU) → personalization profile → boundary rules. One composition function; every AI interaction anywhere in the app goes through it, so behavioral standards are core system behavior, not per-feature hacks.
- **Slide awareness** (A10): the normalizer's page classification tells the tutor whether a slide is core material, references, author info, summary, or objectives — explanations adapt; non-essential content isn't belabored.
- **Topic anchoring** (A11): current topic/subtopic and active learning objective are injected each turn; drift is a validation failure.
- **Learning focus** (A12): examinable/educational content prioritized; decorative/administrative content ignored unless asked; structured lesson guidance.
- **Grounding & coverage** (D21, D22): explanations must be grounded in the slide as source of truth; slides are processed at sentence/concept level and coverage is tracked per concept ID so nothing important is skipped.
- **Boundary control** (B16): the tutor never introduces concepts ahead of the student's progress marker; expands only on explicit request.
- **Language policies** (D23, D24): analogies use universal everyday objects/situations; vocabulary stays conversational; technical terms only when they're the lesson.
- **Teaching Agent** (C12): explains simply, tells stories where apt, links to the slide, asks questions, adapts. Style presets: Professor, Friend, Coach, Storyteller, Everyday-life relater, Step-by-step.
- **Context awareness** (B10): repeated-question and struggle detection over conversation history; follow-up questions; weak-area emphasis; related questions handled without losing thread.
- **Safe adaptation** (D30, D32): per-user learning memory captures which explanation styles worked (quiz results after explanations, re-ask rates). Used as *context injection* for that user only — never runtime prompt mutation, never cross-user.

## Layer 6 — Chat & Interaction UX
*(A2, A3, B3, B6, B7, B9, B11, B12, B14, D18, D19, D20)*

- **Input** (A2): textarea flexes across full width, reserving only the actual button footprint; text wraps before the button area; no dead space.
- **Responsive message layout** (A3, B3): desktop/large-tablet — bubbles retained, but the conversation column uses available page width (no phantom narrow container), proper spacing around nav. Phone — AI responses lose the bubble and span near-full width; user messages stay visually distinct and independently aligned.
- **Overflow safety** (B14): long words, URLs, and code wrap/scroll within the message; the page never scrolls horizontally.
- **Actions** (D18): like/dislike/add-to-notes always visible under every AI response, desktop and mobile — no hover requirement.
- **Scroll** (B6, B7, D19): scroll position saved per conversation and restored on return; auto-scroll to newest after streaming completes (respecting user scroll-up); floating scroll-to-bottom button appears when not at bottom.
- **Request state machine** (B9): idle → sending → streaming → done/failed. Send/resend/auto-send disabled while responding; stalled tasks recovered by the watchdog; the machine always returns to idle — no permanent locks.
- **Navigation** (B11, B12): slide transitions are non-blocking (async prefetch, no synchronous AI work on the nav path); AI context syncs to slide changes via events. Mobile: closing the slide panel restores chat mode and corrects nav icons/active indicators from a single navigation-state store.
- **Slide selection → Ask AI** (D20): text selection in Original or Compact view surfaces an Ask-AI affordance; user types or speaks a question; selection + question + slide context go to the tutor.

## Layer 7 — Notes, Flashcards, Profile, Focus, Gamification
*(C14, C15, C20, D1–D11, D15, B15)*

- **Intelligent Notes** (D9, C15): AI auto-generates structured summaries as the student progresses, organized Course → Topic → Slide; captures concepts, not chat transcripts; Notes agent also suggests highlights, summaries, revision points. Silent capture; user curates.
- **Flashcard agent** (C14, D15): front/back/hints/difficulty/related ALUs; generation runs through the quality pipeline with stall detection and refresh-free recovery.
- **Onboarding & identity** (B15, D2): onboarding collects preferred name; "Student" labels replaced everywhere; student card shows email, display name, plan on one clean row; generic "S" avatar removed; theme toggle stays top-left.
- **Student profile** (C20, D3, D4): stores teaching style, speaking speed, voice, learning history, weak/strong topics, quiz history, notes, progress. Every displayed stat (Sessions, Streak, Achievements, Pace, Velocity, Mastery, Patterns) is wired to real events or deleted; "Best Style" duplication removed; "Mastery: Evidence" either connected to real evidence data or redesigned out.
- **Focus** (D6–D8): a global focus service (app-level, not page-level) so sessions survive navigation and restore on return; sessions auto-start when studying begins in Tutor mode (first AI interaction), cycle into breaks per configured focus cycle, and end on inactivity — no manual start button needed. All Focus page metrics computed from real session records.
- **Gamification** (D10, D11): leaderboard driven by real activity events; Streak Freeze lets users bank/apply freezes to protect streaks through short inactivity, integrated into the streak engine.
- **Mobile polish** (D1, D5, D16, D17): Appearance and Share-Progress sections stack text-row-above-controls on small screens; Upload Slides prevents awkward course-name wrapping; Quick Tips loses its bordered container and flows with the page.

## Layer 8 — Slide Player, Teaching Experience, Voice, Background
*(C17–C19, C22)*

- **Slide Player** (C18): Original mode (exact upload) and Compact mode (teaching slides only, headers merged, non-teaching pages faded/skipped) — both fed by the normalizer's outputs.
- **Live highlighting** (C19): left slide / right tutor split; as the tutor speaks/writes, the frontend highlights the exact paragraph, image, formula, table, or bullet using indexed coordinates and content IDs referenced in the tutor's structured output.
- **Voice** (C17): TTS via Kokoro (primary) / Piper / Coqui behind the `AIService.speak()` seam — natural, fast, adjustable speed/tone, optional cloning later. STT via Whisper — interrupt tutor, ask naturally, resume lesson.
- **Background experience** (C22): Screen Wake Lock during teaching; Media Session API for lock-screen/notification controls where supported. PWA-first; architecture keeps a native iOS shell possible later (Dynamic Island and true background execution are native-only — acknowledged limit, not fought).

## Data & storage rules
- Turso in prod and fresh local dev — **every schema migration runs `db:push` AND `db:push:prod`** or Vercel 500s with "no such table" (known footgun).
- Cloud object storage for documents/derived artifacts (D34); browser storage only for lightweight personalization (D33); per-user isolation for all learning memory (D32).

---

# PART II — IMPLEMENTATION ROADMAP (90 tasks, 9 validated batches of 10)

Execution protocol per batch: implement all 10 → run the batch's validation gate (listed checks + regression of prior gates) → fix failures → only then proceed. (D25, D26)

## Batch 1 — Foundations: AI gateway & quality pipeline (Tier 0)
1. Define `AIService` interface + OpenRouter adapter; remove all direct provider calls above the seam. *(C21)*
2. Model Router: capability registry, free-model availability probing, user OpenRouter key management, fallback ordering. *(C7, C11)*
3. Orchestrator skeleton: task envelope (model+prompt+tool selection), retry policy, progress tracking. *(C11)*
4. System Knowledge Pack: build-time generated app map (pages/features/workflows), loaded at orchestrator init. *(D27)*
5. Multi-orchestrator failover: continuous state snapshot, context-limit detection, seamless rehydrate-and-continue. *(D28)*
6. Stream watchdog: inter-chunk timeout, auto-cancel, clear timeout message, guaranteed input re-enable. *(B8)*
7. Corruption detection layer: detect/repair/discard broken output; corrupt text never renders. *(B1, A1)*
8. Formatting normalizer with before/after logging for review. *(B2, A1)*
9. Structural validator: schema, required fields, counts, empty-response detection. *(C16-1)*
10. Prompt Improvement Pipeline: failure analysis → refined prompt → retry preserving intent; orchestrator quality review on demand. *(D29, C16-2)*

**Gate 1:** kill-switch a streaming response mid-flight → clean timeout UI; feed corrupted fixtures → repaired or regenerated; empty-quiz fixture → caught by validator; provider swap test compiles with a mock `AIService`.

## Batch 2 — Reliability & stuck-state elimination (Tier 1)
11. Root-cause and fix the quiz-emptiness bug using the new validator + retry loop (current top priority). *(D36, B5)*
12. Chat request state machine: inputs disabled while responding, auto-recovery, no permanent locks. *(B9)*
13. Generation failure handling app-wide: no infinite buffering on any generation surface. *(B5)*
14. Flashcard generation stall detection + refresh-free recovery. *(D15)*
15. Tutor session restoration integrity: conversations restore without corrupt/partial messages. *(D14)*
16. Quiz session restoration across navigation. *(D13)*
17. Chat scroll position persistence per conversation. *(B6)*
18. Auto-scroll after streaming + floating scroll-to-bottom button. *(B7, D19)*
19. Slide-navigation freeze fix: non-blocking transitions, AI synced via events. *(B11)*
20. Mobile navigation state store: panel close restores chat mode, icons/indicators always correct. *(B12)*

**Gate 2:** scripted torture pass — stall injection, mid-stream navigation, app restart mid-quiz and mid-conversation, rapid slide flipping on a throttled device; zero stuck states, zero corrupt restorations.

## Batch 3 — Chat & interaction UX (Tier 2)
21. Chat input redesign: full-width, button-area-only reservation, correct wrapping. *(A2)*
22. Desktop/tablet chat width: remove narrow container, use page width, nav spacing. *(B3, A3)*
23. Phone layout: bubble-less near-full-width AI responses; user messages distinct. *(A3)*
24. Message overflow hardening: words/links/code wrap; no horizontal page scroll. *(B14)*
25. Always-visible message actions (like/dislike/add-to-notes) on all devices. *(D18)*
26. Slide text selection → Ask AI with typed or voice question + selection context, both slide views. *(D20)*
27. Identity firewall: fixed app persona, prompt audit for provider/model leaks, output filter. *(B13)*
28. Onboarding flow: preferred name, used app-wide, "Student" labels gone. *(B15)*
29. Student card redesign: email + name + plan on one row; avatar/"Student" removed; theme toggle kept. *(D2)*
30. Small-screen layout fixes: Appearance stacking, Share-Progress stacking, Upload Slides name wrapping, Quick Tips container removal. *(D1, D5, D16, D17)*

**Gate 3:** visual regression at 360px / 768px / 1440px; long-URL and code-block overflow fixtures; identity probing script ("what model are you?") returns persona consistently.

## Batch 4 — Question bank & quiz system (Tier 3)
31. Question bank schema (slide ID, ALU ID, format, difficulty, provenance, used-status) — migrate **both** Turso targets. *(A8)*
32. Shared pool service: Tutor/Exam unified read-write; retrieve-before-generate. *(A7)*
33. Background generation worker: per-slide, pauses during AI responses, resumes after, configurable cache cap, fully silent. *(A6, B4)*
34. Configurable question counts: quick quiz vs large sets, request-driven, no hard limit. *(A5)*
35. Question formats: MCQ, true/false, fill-blank, short answer, practical. *(C13)*
36. AI-initiated quiz tool: tutor triggers quiz view + instant init from bank. *(A4, B4)*
37. Quiz continuation: another set from same slide's unused bank; no auto-advance. *(A9)*
38. Exam-mode course browser: cards + search/filter replacing dropdown. *(D12)*
39. Dashboard Quick Quiz: immediate launch via shared quiz-launch service, no intermediate prompts. *(D35)*
40. Image-based question generation via vision layer + graceful degradation; no-material case explained clearly. *(B5, D36)*

**Gate 4:** study a slide 5 min → bank populated silently; exam pulls bank before generating (verify via provenance); "give me 40 questions" and "quick 5-question quiz" both honored; AI "quiz me" jumps straight into a running quiz.

## Batch 5 — Document ingestion & ALU pipeline (Tier 4)
41. Upload layer: full format matrix via LibreOffice/PyMuPDF/python-pptx/python-docx/Pandoc/ImageMagick; async job with progress. *(C2)*
42. Document Normalizer: page classification, title-slide merging, original + compact + full index, positions preserved. *(C3)*
43. Structured Document Builder: per-page typed content objects with stable IDs and coordinates. *(C4)*
44. Extraction layer + orchestrator-decided OCR (PaddleOCR → Tesseract). *(C5, C6)*
45. Vision layer: diagrams/charts/drawings/handwriting via best free OpenRouter vision model. *(C7)*
46. Formula layer: Pix2Tex / LaTeX-OCR. *(C8)*
47. Indexing layer: object → page/position/size/section/topic/ALU backlinks. *(C9)*
48. ALU Builder: full ALU schema with related-ALU graph and page refs. *(C10)*
49. Storage split: cloud object storage for documents (guided setup), browser storage restricted to lightweight personalization. *(D34, D33)*
50. Slide Player dual mode: Original + Compact (merged headers, faded/skipped non-teaching pages). *(C18)*

**Gate 5:** ingest one real deck per format (PDF, PPTX, DOCX, EPUB, scanned image); verify classification accuracy, ID/coordinate integrity (spot-click 20 objects → correct highlight region), ALU coverage of all teaching pages.

## Batch 6 — Teaching intelligence (Tier 5)
51. Slide-purpose-aware tutoring: classification drives explanation depth; non-essential content skipped. *(A10)*
52. Topic/subtopic anchoring to active learning objective; drift treated as validation failure. *(A11)*
53. Learning-focused responses: examinable content priority, structured lesson guidance. *(A12)*
54. Slide-grounded explanations: slide as source of truth, all important concepts accounted for. *(D21)*
55. Sentence/concept-level coverage tracking per slide. *(D22)*
56. Learning boundary control: progress-marker gating, expand only on request. *(B16)*
57. Analogy + vocabulary policies in the prompt layer (everyday objects, conversational language). *(D23, D24)*
58. Teaching Agent style presets (Professor/Friend/Coach/Storyteller/Everyday/Step-by-step) with natural, adaptive delivery. *(C12)*
59. Context awareness: repeated-question and struggle detection, follow-ups, weak-area focus. *(B10)*
60. Master Prompt composition system: layered assembly of identity, formatting, style, slide context, personalization, boundaries — used by every AI surface. *(D37)*

**Gate 6:** teach a full real lecture end-to-end; audit transcript for grounding, coverage, vocabulary, analogy quality, no premature concepts, consistent persona; repeat a question 3× → tutor notices and adapts.

## Batch 7 — Personalization, notes, profile truth (Tier 6)
61. Student profile store: style, speed, voice, history, weak/strong topics, quiz history, progress. *(C20)*
62. Personalized learning memory: per-user pattern capture, strictly isolated. *(D32)*
63. Safe learning adaptation: successful-pattern capture used as context only; no runtime prompt mutation. *(D30)*
64. Protected system configuration: AI improvements land as suggestions requiring explicit validation. *(D31)*
65. Intelligent Notes: silent auto-summarization into Course → Topic → Slide notebook; concepts, not transcripts. *(D9)*
66. Notes agent: highlight/summary/revision-point suggestions. *(C15)*
67. Flashcard agent: front/back/hints/difficulty/related-ALUs through the quality pipeline. *(C14)*
68. Learning Profile cleanup: remove duplicates, connect or redesign "Mastery: Evidence", real preferences only. *(D3)*
69. Profile statistics audit: every stat live-wired or removed. *(D4)*
70. Leaderboard validation: rankings/achievements from real activity events. *(D10)*

**Gate 7:** two test users study differently → profiles diverge and stay isolated; every number on profile/leaderboard traced to a real event query; grep confirms zero hardcoded stats.

## Batch 8 — Focus, engagement, voice, experience (Tier 7)
71. Global focus session service: survives navigation, auto-restores on return. *(D7)*
72. Automatic focus tracking: tutor activity starts sessions, configured break cycles, inactivity end — no manual start. *(D8)*
73. Focus dashboard metrics computed from real session records. *(D6)*
74. Streak engine + Streak Freeze (earn/apply, accidental-loss protection). *(D11)*
75. TTS adapter (Kokoro primary; Piper/Coqui fallback): natural, fast, speed/tone controls. *(C17)*
76. STT via Whisper: interrupt tutor, ask naturally, resume lesson. *(C17)*
77. Voice mode integration with teaching flow and highlighting sync.
78. Live highlighting: tutor references content IDs → frontend highlights paragraph/image/formula/table/bullet via indexed coordinates. *(C19)*
79. Background experience: Screen Wake Lock during teaching, Media Session lock-screen controls, PWA-first / native-ready. *(C22)*
80. Hermes-readiness audit: verify nothing above `AIService` references OpenRouter; document the swap procedure. *(C21)*

**Gate 8:** start focus in tutor → navigate everywhere → timer intact; voice lesson with mid-sentence interruption → clean resume; highlights land on correct regions across 3 documents; phone lock screen shows media controls.

## Batch 9 — Full system validation (Tier 8) *(D26)*
81. Audit: chat & streaming (all reliability behaviors under fault injection).
82. Audit: quiz system end-to-end across all entry points and formats.
83. Audit: ingestion pipeline against a corpus of real course materials, all formats.
84. Audit: teaching quality — grounding, coverage, boundaries, style fidelity, identity.
85. Audit: personalization & data isolation, suggestion-approval gates. 
86. Audit: focus/streak/leaderboard math against synthetic event histories.
87. Audit: voice + highlighting + background behaviors across devices/browsers.
88. Audit: mobile layouts and navigation states at all breakpoints.
89. Cross-integration regression: full user journey (onboard → upload → learn → quiz → notes → review) without manual intervention.
90. Final inconsistency sweep: resolve everything found in 81–89; confirm every requirement in the traceability matrix is demonstrably live. *(D26)*

---

# PART III — TRACEABILITY MATRIX

| Doc item | Task(s) | | Doc item | Task(s) |
|---|---|---|---|---|
| A1 | 7, 8 | | D1 | 30 |
| A2 | 21 | | D2 | 29 |
| A3 | 22, 23 | | D3 | 68 |
| A4 | 36 | | D4 | 69 |
| A5 | 34 | | D5 | 30 |
| A6 | 33 | | D6 | 73 |
| A7 | 32 | | D7 | 71 |
| A8 | 31 | | D8 | 72 |
| A9 | 37 | | D9 | 65 |
| A10 | 51 | | D10 | 70 |
| A11 | 52 | | D11 | 74 |
| A12 | 53 | | D12 | 38 |
| B1 | 7 | | D13 | 16 |
| B2 | 8 | | D14 | 15 |
| B3 | 22 | | D15 | 14, 67 |
| B4 | 33, 36 | | D16 | 30 |
| B5 | 11, 13, 40 | | D17 | 30 |
| B6 | 17 | | D18 | 25 |
| B7 | 18 | | D19 | 18 |
| B8 | 6 | | D20 | 26 |
| B9 | 12 | | D21 | 54 |
| B10 | 59 | | D22 | 55 |
| B11 | 19 | | D23 | 57 |
| B12 | 20 | | D24 | 57 |
| B13 | 27 | | D25 | this document |
| B14 | 24 | | D26 | 81–90 |
| B15 | 28 | | D27 | 4 |
| B16 | 56 | | D28 | 5 |
| C1 (user layer) | all UI tasks | | D29 | 10 |
| C2 | 41 | | D30 | 63 |
| C3 | 42 | | D31 | 64 |
| C4 | 43 | | D32 | 62 |
| C5 | 44 | | D33 | 49 |
| C6 | 44 | | D34 | 49 |
| C7 | 2, 45 | | D35 | 39 |
| C8 | 46 | | D36 | 11, 40 |
| C9 | 47 | | D37 | 60 |
| C10 | 48 | | | |
| C11 | 3 | | | |
| C12 | 58 | | | |
| C13 | 35 | | | |
| C14 | 67 | | | |
| C15 | 65, 66 | | | |
| C16 | 9, 10 | | | |
| C17 | 75, 76 | | | |
| C18 | 50 | | | |
| C19 | 78 | | | |
| C20 | 61 | | | |
| C21 | 1, 80 | | | |
| C22 | 79 | | | |
| Philosophy ("understand, not read") | embodied in Layers 3 & 5; validated in task 84 | | | |

**Additions beyond the document** (allowed by the brief, all reliability/UX-motivated): build-time-generated System Knowledge Pack (keeps D27 from going stale), provenance field on questions (makes A7 verifiable), before/after formatting logs (makes B2 reviewable), single shared quiz-launch service (makes D36 structurally guaranteed rather than policed), request-state machine as an explicit store (makes B9 provable), fault-injection validation gates (makes D26 repeatable).
