# SkillForge AI — Implementation Plan, Phases 4–8

**For:** opencode (or any agent picking up this build cold)
**Project:** SkillForge AI — Smart India Hackathon 2026, Problem Statement SIH26101 (MoSPI / DIID)
**Repo:** `/Users/abdulrehman/Developer/Cognitives-SIH`
**Status:** Phases 1–3 complete, built and independently verified. Phases 4–8 remain.

---

## 0. Read this first — the one rule that governs everything

PRD §2.5, the product's entire differentiation:

> **The LLM is responsible for language and content generation, never for deciding a number.** Competency scores, gap sizes, and recommendation rankings are computed by deterministic rules and formulas over structured evidence. The LLM's job is limited to: generating assessment questions, writing plain-language reasoning, and powering the grounded AI tutor.

Every competing platform (iGOT Karmayogi, generic LMS) validates competency *after* a course completes. SkillForge diagnoses *before*, with evidence. When a judge asks "how was that score computed?", the answer must be a formula you can point at — not "the AI decided."

**This is enforced mechanically, not by discipline.** Nothing under `src/lib/engines/` may import from `src/lib/ai/`. Two independent guards exist and have been verified to genuinely fail on violation:
- ESLint `no-restricted-imports` in `eslint.config.mjs`
- `tests/architecture/engines-boundary.test.ts`

If you need a number, write a pure function in `src/lib/engines/`. If you need a sentence, call the AI adapter. Never blur these.

### Non-negotiable product rules

1. **Every score shows its evidence.** `EvidenceDrawer` is a P0 feature, not decoration. Displayed contributions must sum to the displayed score.
2. **Every recommendation shows its computed reason breakdown** — real per-factor values from `reasonsJson`, never a paraphrase.
3. **Every generated question carries `sourceChunkId`.** No untraceable questions.
4. **The tutor refuses out-of-scope questions.** Grounded or explicitly silent — never guessing.
5. **Zero evidence renders "Not yet assessed"** — never a fabricated `0`, never a fabricated gap.
6. **No gamification.** No streaks, XP, badges, confetti. Institutional dignity — these are senior government statisticians.
7. **No bare percentages as headlines.** Measured levels with confidence ranges.
8. **Non-judgmental language.** A gap is "room to grow", never a deficiency or failure.
9. **AI keys are server-only.** Never `NEXT_PUBLIC_`. RBAC checked server-side on every route and mutation.

---

## 1. Current state — what exists and must be reused

### Verified stack versions (do NOT substitute from memory)

| Package | Version | Note |
|---|---|---|
| next | **16.3.3** | Uses `src/proxy.ts`, **not** `middleware.ts`. Node.js runtime. |
| react / react-dom | 19.2.8 | |
| tailwindcss | 4.3.3 | `@theme` block in `src/app/globals.css`, OKLCH tokens |
| prisma / @prisma/client | **7.10.0** | **Not 8.x** — that's still a release candidate |
| next-auth | 5.0.0-beta.32 | Credentials provider ⇒ **JWT sessions required** |
| @auth/prisma-adapter | 2.11.3 | |
| ai | 7.0.79 | Vercel AI SDK |
| @openrouter/ai-sdk-provider | 3.0.0 | |
| @google/genai | 2.19.0 | Direct Gemini |
| vitest | 4.x | `pnpm test` |

**Prisma 7 breaking change — important.** The datasource block in `prisma/schema.prisma` has **no `url`**. Connection config lives in `prisma.config.ts` (CLI only), and `PrismaClient` is constructed with the `PrismaPg` driver adapter.

```ts
import { db } from "@/lib/db/client";   // ✅ always
// ❌ never: new PrismaClient()
```

### Scripts

```
pnpm dev | build | start | lint | test | test:watch
pnpm db:generate | db:migrate | db:deploy | db:seed | db:studio
```

### Environment variables (`.env.example`)

`DATABASE_URL`, `AUTH_SECRET`, `OPENROUTER_API_KEY`, `GEMINI_API_KEY`, `AI_PROVIDER`, `UPLOADTHING_TOKEN`, `NEXT_PUBLIC_APP_URL`

> ⚠️ **As of handoff, `DATABASE_URL` is a non-connecting placeholder and both AI keys are empty.** Nothing has been run against a real database or a live model. See §7 for what this means for you.

### Existing modules — reuse, do not rewrite

**Engines (pure, deterministic, no AI imports):**
- `src/lib/engines/competency.ts` — `scoreCompetency(input)` → `{ current, level, confidence, confidenceBand, displayRange, terms, evidence }`. Also `computeRelevance`, `computeAssessmentScore`, `recencyDecay`, `TERM_WEIGHTS`, `CONFIDENCE_BANDS`, `RECENCY_HALF_LIFE_MONTHS`, `HISTORY_DECAY_BASE`.
- `src/lib/engines/gap.ts` — `computeGapAnalysis(inputs)` → `{ gaps, unknown }`. Also `classifySeverity`, `computeGapSize`, `computeWeighted`, `SEVERITY_THRESHOLDS`, `CRITICAL_OVERRIDE`.

**AI adapter** (`src/lib/ai/`) — build on this, don't replace it:
```ts
export interface AiProvider {
  generateObject<T>(opts: GenerateObjectOptions<T>): Promise<T>;
  streamText(opts: StreamTextOptions): AsyncIterable<string>;
}
```
- `provider.ts` → `getAiProvider()`. `AI_PROVIDER=gemini` selects direct Gemini; anything else → OpenRouter (`google/gemini-3.7-flash` with a `models` failover array).
- `errors.ts` → `AiError`, `withAiErrorHandling`, `classifyAiError`. Kinds: `RATE_LIMIT | TIMEOUT | INVALID_RESPONSE | NETWORK` — these map 1:1 onto the four `AiErrorState` UI variants.
- **`streamText` is currently a stub.** Phase 7 must implement it for real.
- **There is no mock provider and must not be one** — live API only, an explicit user decision. Handle failure with typed errors + retry UI, never with fake data.

**Auth / RBAC:**
- `src/lib/auth/rbac.ts` → `requireRole(role)` for pages (redirects), `requireRoleApi(role | role[])` for route handlers (throws), `authErrorResponse`.
- `src/proxy.ts` — coarse route protection by role prefix.

**Caliper design-system primitives** (`src/components/caliper/`) — **reuse these; do not create variants**:
`caliper-gauge.tsx`, `score-readout.tsx`, `domain-matrix.tsx`, `gap-card.tsx`, `gap-dashboard.tsx`, `evidence-drawer.tsx`, `evidence-drawer-live.tsx`, `severity-formula-disclosure.tsx`, `ai-error-state.tsx`, `processing-state.tsx`

**Still to build (Phases 6–7):** `PathTimeline`, `ReasonBreakdown`, `SourceChunkCard`.

**Design tokens** — already in `src/app/globals.css` via Tailwind 4 `@theme`, mapped onto shadcn variable names so shadcn primitives inherit automatically:

| Token | Meaning |
|---|---|
| `--color-measure` | primary — measured / known |
| `--color-target` | teal — target / on-track |
| `--color-gap` | amber-red — gap severity |
| `--color-critical` | critical severity |
| `--color-unmeasured` | "not yet assessed" |

Type: **Archivo** (UI) + **IBM Plex Mono** for all numerals with `font-variant-numeric: tabular-nums` (utility class `.tabular-mono`) so gauge readouts don't jitter. Radius 2–6px only. Motion ≤200ms, transform/opacity only, full `prefers-reduced-motion` support.

**Dev fixture routes** — the established pattern for building UI without a live DB. Follow it:
`/dev/caliper`, `/dev/assessment`, `/dev/assessment-results`, `/dev/gaps` (all guarded by `src/app/dev/layout.tsx`, which `notFound()`s in production).

### Reference documents in this repo — read before coding

| File | Why |
|---|---|
| `docs/engine-specifications.md` | **Normative.** Exact formulas for all four engines. §3 and §4 cover Phase 6. |
| `docs/pgvector-prisma-notes.md` | **Read before writing any vector code in Phase 4.** Every item is a bug someone already hit. |
| `docs/course-catalog-research.md` | ~82 real iGOT/NSSTA courses from official MoSPI documents — the Phase 6 seed data. |
| `PRODUCT.md` | Brand, voice, design direction. |
| `SIH Planning and Preparation (1).pdf` | The v4.0 PRD — source of truth. (`SIH Planning Draft.md` is a superseded v2.0.) |

### Data model

`prisma/schema.prisma` already contains **every** entity for all phases — including tables Phases 1–3 don't use. You should not need new models for Phases 4–8. Relevant to what's ahead:

- `Document` — `ownerId`, `uploadThingKey`, `uploadThingUrl`, `type`, `processingStatus` (`PENDING|EXTRACTING|CHUNKING|EMBEDDING|READY|FAILED`), `errorMessage`, `chunkCount`
- `DocumentChunk` — `documentId`, `content`, `chunkIndex`, `tokenCount`, `embedding Unsupported("vector(1536)")`
- `Course` — `source` (`IGOT|NSSTA`), `title`, competencies, `level`, `durationHours`, `externalUrl`, `embedding Unsupported("vector(1536)")?`
- `Question` — `stem`, `optionsJson`, `correctAnswer`, `explanation`, `difficulty`, `competencyId`, **`sourceChunkId`**, `reviewStatus` (`DRAFT|APPROVED|REJECTED`)
- `Recommendation` — `userId`, `courseId`, `gapId`, `score`, **`reasonsJson`**, `status`
- `LearningPath` / `LearningPathItem` — `order`, `weekNumber`, `rationale`
- `AuditLog` — `actorId`, `action`, `resourceType`, `resourceId`, `metadataJson`

The init migration at `prisma/migrations/20260826000000_init/migration.sql` includes `CREATE EXTENSION IF NOT EXISTS vector` and both hand-written HNSW indexes. It has been diffed against the schema and matches exactly (the only intentional extra is the two HNSW statements, which Prisma's schema language cannot express).

---

## 2. Phase 4 — Document & RAG Pipeline

**This is the highest-risk phase and it blocks two P0 features (Phases 5 and 7). Do not defer it.** PRD §6.2 explicitly warns against building the retrieval layer twice — build it once here, consumed by both the MCQ generator and the tutor.

### ⚠️ Critical constraint discovered during planning

**OpenRouter serves zero embedding models.** This was verified against its live `/api/v1/models` catalog. It is chat-completions only. Embeddings **must** go directly to Gemini. Do not route an embedding call through OpenRouter; do not assume this has changed without re-checking the catalog.

### Embeddings (`src/lib/rag/embed.ts`)

- Model `gemini-embedding-001`, endpoint `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents`
- **`outputDimensionality: 1536`** — MTEB parity with 3072 at half the storage
- **Manually L2-normalize every vector.** This model does *not* auto-normalize below 3072 dims. Skipping this makes cosine similarity silently wrong — the worst failure mode, because retrieval still returns plausible-looking results.
- `taskType: RETRIEVAL_DOCUMENT` when indexing, `RETRIEVAL_QUERY` when searching. Asymmetric on purpose.
- Max 2048 tokens per input; batch ≤100 inputs per request.
- **Assert `vector.length === 1536` before every write.** A dimension mismatch otherwise fails at the database, far from its cause.

### Pipeline

`upload (UploadThing) → extract → chunk → embed → store`

- **Extract:** `pdf-parse` (PDF), `mammoth` (DOCX), `officeparser` (PPTX). Video/audio transcription is explicitly P2 — out of scope.
- **Chunk** (`src/lib/rag/chunk.ts`): ~500 tokens, 15% overlap, split on paragraph boundaries. Persist `chunkIndex` and `tokenCount`.
- **Store:** originals go to UploadThing (object storage), **never** into the relational DB. Only extracted text + vectors live in Postgres.
- **Processing route** (`src/app/api/documents/[id]/process/route.ts`): `export const maxDuration = 60`. Advance `Document.processingStatus` through each stage so the UI shows real progress and, on failure, the **specific stage** that failed. Wire to the existing `ProcessingState` component — it already renders staged progress and an explicit failure stage.

### Retrieval (`src/lib/rag/retrieve.ts`)

```ts
const rows = await db.$queryRaw<{ id: string; content: string; similarity: number }[]>`
  SELECT id, content, 1 - (embedding <=> ${queryEmbedding}::vector) AS similarity
  FROM "DocumentChunk"
  WHERE "documentId" = ${documentId}
  ORDER BY embedding <=> ${queryEmbedding}::vector
  LIMIT ${k}
`;
```

**Four rules from `docs/pgvector-prisma-notes.md` — violating any of these produces a confusing runtime error:**
1. Bind a **string**, never a JS array — `pgvector.toSql([...])` produces `'[1,2,3]'`, which binds as `text` and casts cleanly. Binding a raw array is the #1 cause of `expected type vector`.
2. Always `SELECT embedding::text`, never the bare column — Prisma cannot deserialize the `vector` type.
3. Cast the parameter with `::vector` on **both** sides of a similarity query.
4. Use `<=>` (cosine) only — it must match the `vector_cosine_ops` index. Mixing `<->` (L2) silently skips the index.

Also: `COUNT(*)` returns `BigInt`, which won't serialize across the RSC boundary — cast to `::int` in SQL. And Prisma Studio cannot open tables with vector columns; use `psql` to debug. That's expected, not a bug in your code.

### Trainer document UI

`src/app/(trainer)/trainer/documents` — upload, live processing status via `ProcessingState`, list with chunk counts, explicit failure states with retry. RBAC: `requireRole("TRAINER")`.

### Verification
- Seed a known PDF; assert `chunkCount > 0` and **every** embedding is exactly 1536-dim.
- Assert `retrieve()` returns the expected chunk for a question whose answer you know is in the document.
- Assert an off-topic query returns low similarity (this is what Phase 7's refusal threshold depends on).

---

## 3. Phase 5 — MCQ Generator + Assessment Engine

### RAG-grounded generation
- Trainer selects question count, topic, and difficulty.
- **Retrieve first, then generate.** Questions are generated from the document's own chunks — never free-form from the model's general knowledge.
- **Every question must persist `sourceChunkId`.** PRD §4.7 acceptance criterion: every generated question is traceable to a specific source chunk. Reject/discard any generated question that can't be tied to one.
- Each question carries: stem, 4 options, correct answer, explanation, difficulty, and source chunk reference.
- Use `generateObject` with a Zod schema — never free-text parsing. Follow the pattern in `src/lib/assessment/generate-diagnostic.ts`.
- Target ≤30s (PRD §4.11). Set `maxDuration` accordingly.

### Trainer review queue
- **Nothing publishes unreviewed.** `reviewStatus` starts `DRAFT`; only `APPROVED` questions can appear in a published assessment.
- Trainer can edit stem/options/answer/explanation before approving.
- Build `SourceChunkCard` (new Caliper primitive) to show the originating chunk beside each question — this is what makes "traceable" visible rather than merely stored.

### Scoring feedback loop
- Difficulty-weighted scoring, reusing `scoreCompetency` from `src/lib/engines/competency.ts`. **Do not write a second scoring path.**
- PRD §4.8 acceptance criterion: an assessment result **always** updates the linked competency score, visibly, without manual intervention. After submission, the officer must see their score change and the new evidence row appear in `EvidenceDrawer`.

### Verification
- A generated question with no resolvable `sourceChunkId` never persists.
- An unreviewed (`DRAFT`) question cannot appear in a published assessment.
- Submitting an attempt changes `UserCompetency.currentScore` and adds a `CompetencyEvidence` row whose contributions still sum to the new score.

---

## 4. Phase 6 — Recommendation + Learning Path Engine

### Seed the course catalog first
Use `docs/course-catalog-research.md` — **~82 real courses** transcribed from official MoSPI/NSSTA documents (the NSSTA FY2025-26 Advance Training Calendar and the NSSTA iGOT SADHANA Saptah office memorandum), including genuine `portal.igotkarmayogi.gov.in` URLs.

This is an **upgrade over the PRD**, which assumed a "clearly labelled mock dataset." Real catalog data is materially more defensible when a judge asks whether recommendations point anywhere real. Guidance:
- Map each course onto the 33-competency taxonomy. Coverage is strong across all four domains.
- `externalUrl`: use the real deep link where one exists (Annexure II); otherwise `https://portal.igotkarmayogi.gov.in/` or `https://nssta.gov.in/`. **Do not fabricate deep links that would 404 in a live demo.**
- Store the source citation per row so the UI can attribute the catalog honestly.
- **Deliberately leave a few competencies with only weak matches** — the engine must exercise its "closest match" caveat path. A demo where every gap has a perfect course is less credible than one that admits catalog limits.
- Embed every course (same 1536-dim pipeline from Phase 4).

### `src/lib/engines/recommendation.ts` — pure, per `docs/engine-specifications.md` §3

```
score = 0.35 · semanticSimilarity      // pgvector cosine: gap text ↔ course embedding
      + 0.25 · gapSeverityWeight       // CRITICAL 1.0 / HIGH 0.75 / MEDIUM 0.5 / LOW 0.25
      + 0.15 · roleRelevance           // course competencies ∩ role target vector
      + 0.10 · prerequisiteReadiness   // 1.0 all prereqs met, 0.5 partial, 0.2 unmet
      + 0.10 · difficultyFit           // 1 − |courseLevel − (currentLevel+1)| / 4
      + 0.05 · departmentPriority
```

`difficultyFit` peaks at **one level above current** — the next reachable step, not the hardest available course.

**The engine is pure.** Similarity values are computed by the RAG layer and passed *in* as arguments — the engine itself must not query the database or import `lib/ai`.

Persist **every term** into `reasonsJson`. Build `ReasonBreakdown` (new primitive) to render actual per-factor contributions. PRD §4.5 acceptance: no course appears without a visible reason and rank.

### `src/lib/engines/learning-path.ts` — per `docs/engine-specifications.md` §4

Kahn's topological sort over `CompetencyPrerequisite`, ties broken by gap priority, then greedy bin-packing into weeks at `maxWeeklyHours` (default 5) → a 6–8 week ordered sequence.

**Cycle detection is mandatory and must throw** with the offending competency IDs. A silently truncated learning path is a wrong answer that looks like a right one. (The seeded DAG is acyclic — this guards against future edits.)

Build `PathTimeline` (new primitive): week-banded sequence with prerequisite links drawn.

### Verification
- No item appears before any of its prerequisites.
- A cyclic graph throws rather than truncating.
- Every recommendation renders a per-factor breakdown; no unexplained ranking.
- 100-run determinism on both engines.

---

## 5. Phase 7 — AI Tutor (RAG-grounded)

**Implement `streamText` for real** in both `src/lib/ai/openrouter.ts` and `src/lib/ai/gemini.ts` (currently stubbed).

- Streaming route at `src/app/api/tutor/route.ts`.
- **Retrieval before generation, always.** Reuse `src/lib/rag/retrieve.ts` from Phase 4 — do not build a second retrieval path.
- **The refusal rule (PRD §4.9 acceptance criterion):** if top similarity `< 0.65`, the tutor **states the question falls outside the uploaded material** rather than answering from general knowledge. This is the single most important behavior in the phase — an ungrounded confident answer during a live demo is the worst possible failure.
- Every substantive answer renders its source chunks via `SourceChunkCard`.
- Calibrate explanations to the learner's current competency level (read from `UserCompetency`).
- Follow-up actions: *give an example*, *summarize this*, *quiz me* — the last hands off to the Phase 5 generator.

### Verification
- A question answerable from the document returns a grounded answer **with citations**.
- An off-topic question returns the explicit out-of-scope response — **not** an invented answer. Test this deliberately; it's the acceptance criterion.

---

## 6. Phase 8 — Dashboards, Audit, Demo Hardening

### Learner dashboard (`/dashboard`)
Overall readiness, `DomainMatrix` across the four domains, prioritized gaps, learning path, next recommended action, tutor entry. **One clear next action** — route to the single highest-priority thing, not a wall of equally-weighted options (PRD §5.4, and PRODUCT.md principle 3).

### Trainer dashboard
Material management, question bank review, assessment publishing, learner performance, topics flagged as poorly performing.

### Admin dashboard
Organization-wide competency distribution, department/role-level gaps, training effectiveness, critical shortages, with **drill-down: organization → department → role → skill**. Visually distinct from the learner view so aggregate data is never mistaken for personal data.

> Predictive workforce analytics is explicitly **P2 / out of scope** (PRD §2.6). Architecture-ready only — do not build it.

### Audit logging
Write `AuditLog` rows on every sensitive operation: assessment submission, question approval, document upload/delete, role changes, admin data access. PRD §4.11 requires authorization checks *and* audit logging on sensitive operations.

### `scripts/warm-demo.ts` — demo resilience
The user chose **live-API-only** with no mock provider, and PRD §6.2 lists LLM failure during the live demo as a top risk. This script is the sanctioned mitigation:

Pre-run the demo officer's diagnostic, gap analysis, recommendations, and one tutor exchange, **persisting real generated rows to Postgres.** The Golden Demo Flow then renders from the database and survives an API outage mid-walkthrough. This is real generated data, not a mock — it does not violate the live-API-only decision.

### Performance (PRD §4.11)
Diagnostic generation + scoring ≤30s; MCQ generation ≤30s; dashboard load ≤2s. Use server components + `Suspense`; run independent queries in parallel.

### Final passes
- Light + dark screenshot pass on **every** screen.
- Keyboard-only traversal of assessment and dashboard flows.
- `prefers-reduced-motion` verified.
- Contrast ≥4.5:1 in both themes.

---

## 7. Before you can verify anything end-to-end

**These are unset at handoff and block all live verification.** Phases 1–3 were verified as pure logic, types, and UI against fixtures only — no code has ever run against a real database or model.

1. **Neon Postgres.** Create a project, put the connection string in `.env` as `DATABASE_URL`, then run in the Neon SQL editor:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
   pgvector is available on all Neon plans; the extension is named `vector`, not `pgvector`.

2. **Apply schema and seed:**
   ```bash
   pnpm db:deploy && pnpm db:seed
   ```
   Demo logins after seeding: `learner@` / `trainer@` / `admin@skillforge.demo`, password `SkillForge!2026`.

3. **API keys:** `OPENROUTER_API_KEY` (generation) and `GEMINI_API_KEY` (**required** — embeddings cannot use OpenRouter). Optionally `AI_PROVIDER=gemini` to route generation through Gemini directly too.

4. **UploadThing:** `UPLOADTHING_TOKEN` for Phase 4 document storage.

**Known-unverified paths inherited from Phases 1–3** — exercise these once a database exists:
- `loadGapAnalysis`'s Postgres joins (`RoleCompetency` / `UserCompetency` / `DepartmentPriority`) and the `SkillGap` upsert.
- The assessment submit route's prior-attempt lookback and evidence dedup-on-resubmit.
- Live AI-generated gap reason text (only the deterministic fallback has been exercised).
- Any live LLM call at all.

---

## 8. The Golden Demo Flow — what all of this is for

PRD §5.3. All 12 steps must work **live, end-to-end, for one officer**. This is the evaluation criterion.

1. Officer logs in, profile is complete
2. System maps role → required competencies
3. Diagnostic assessment measures current competency
4. Skill Gap Engine identifies and prioritizes gaps (Critical/High/Medium/Low)
5. Recommendation Engine surfaces relevant iGOT + NSSTA entries
6. Learning Path Engine produces an ordered pathway
7. Officer opens the AI Tutor, asks a grounded question about course material
8. Trainer uploads a document, generates and reviews an MCQ set
9. Officer completes the quiz, gets instant feedback
10. **Competency score updates from the new evidence, visibly**
11. Platform recommends the next step
12. Administrator opens Workforce Intelligence, sees department-level gaps

Steps 1–6 and 10–12 are already reachable once Phases 4–6 land. **Protect that core path first** — PRD §6.2 notes it demonstrates the full closed loop even if the tutor or MCQ generator slip.

---

## 9. Definition of done for each phase

- `pnpm build`, `pnpm lint`, `pnpm test` all pass.
- New engine code has tests asserting: 100-run determinism, exact threshold boundaries, null propagation, and (where relevant) that evidence contributions sum to the displayed score.
- The architecture boundary test still passes — `lib/engines/` never imports `lib/ai/`.
- UI verified **yourself** in both light and dark themes. Don't ask the user to check what you can check.
- Build UI against typed fixtures under `/dev/` when the database isn't available, following the existing pattern.
- **Never invent a connection string or an API key.** If something can't be verified without one, say so explicitly rather than claiming it works.
