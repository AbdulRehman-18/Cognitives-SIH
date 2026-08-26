# SkillForge AI — Project Summary & Agent Onboarding

**Read this first if you are an agent picking up this project.**
Then read `RestPlan.md` (Phases 4–8, your actual work), then the reference docs in `docs/`.

- **Project:** SkillForge AI — Smart India Hackathon 2026, Problem Statement **SIH26101** (MoSPI / DIID)
- **Repo:** `/Users/abdulrehman/Developer/Cognitives-SIH`
- **Owner:** Abdul Rehman (Team Lead)
- **Status at handoff:** Phases 1–3 of 8 complete, built and independently verified. Phases 4–8 remain.
- **Scale:** 80 TypeScript files, ~7,100 lines, 47 passing tests, build + lint clean.

---

## 1. What this product is (and why it's different)

MoSPI statistical officers have access to a large training catalog (iGOT Karmayogi, 2,400+ courses) but no way to know *which* courses close a real gap in their specific role. Training is generic; competency is unmeasured.

**SkillForge AI measures what an officer doesn't yet know — with evidence — before recommending training.**

The structural difference from every platform researched:

| | Competency source | Recommendation logic |
|---|---|---|
| iGOT Karmayogi | Role→framework mapping; validates mastery *after* course completion | Tag-matching, completion-driven |
| Generic enterprise LMS | Self-reported profile fields | Tag-matching |
| **SkillForge AI** | **Diagnostic assessment → deterministic, evidence-based score** | **Hybrid semantic + rule-based ranking, with stated reasoning** |

Three novelties: **diagnostic-before-training** (not validation-after), **role-specific target vectors** (not one shared checklist), and **a living profile** that recalibrates with every assessment.

SkillForge is *not* a course host and not an iGOT competitor. It is the measurement and routing layer on top of iGOT + NSSTA.

---

## 2. THE governing rule — everything defers to this

PRD §2.5:

> **The LLM is responsible for language and content generation, never for deciding a number.** Competency scores, gap sizes, and recommendation rankings are computed by deterministic rules and formulas over structured evidence. The LLM's job is limited to: generating assessment questions, writing plain-language reasoning, and powering the grounded AI tutor.

**Why it exists:** when a hackathon judge asks *"how was that score computed?"*, the answer must be a formula you can point at — not "the AI decided." This is the product's entire defensibility.

**How it's enforced — mechanically, not by discipline.** Nothing under `src/lib/engines/` may import from `src/lib/ai/`. Two independent guards exist, and **I verified both genuinely fail** by planting a violating file:
- ESLint `no-restricted-imports` (`eslint.config.mjs`) — errors with the PRD §2.5 rationale in the message
- `tests/architecture/engines-boundary.test.ts` — fails the build

**Practical rule:** need a number? Write a pure function in `src/lib/engines/`. Need a sentence? Call the AI adapter. Never blur these.

### The nine product rules

1. Every score shows its evidence (`EvidenceDrawer` is P0, not decoration; contributions must sum to the score).
2. Every recommendation shows its computed per-factor breakdown — real values, never a paraphrase.
3. Every generated question carries `sourceChunkId`. No untraceable questions.
4. The tutor refuses out-of-scope questions. Grounded or explicitly silent — never guessing.
5. Zero evidence ⇒ **"Not yet assessed"**, never a fabricated `0`, never a fabricated gap.
6. **No gamification.** No streaks, XP, badges, confetti. These are senior government statisticians.
7. No bare percentages as headlines — measured levels with confidence ranges.
8. Non-judgmental language. A gap is *"room to grow"*, never a deficiency.
9. AI keys server-only (never `NEXT_PUBLIC_`); RBAC server-side on every route and mutation.

---

## 3. Stack — verified versions, do not substitute from memory

| Package | Version | Critical note |
|---|---|---|
| next | **16.3.3** | Uses **`src/proxy.ts`**, not `middleware.ts`. Node.js runtime. |
| react / react-dom | 19.2.8 | |
| tailwindcss | 4.3.3 | `@theme` in `globals.css`, OKLCH tokens |
| prisma / @prisma/client | **7.10.0** | **Not 8.x** — still a release candidate |
| next-auth | 5.0.0-beta.32 | Credentials ⇒ **JWT sessions required** (no DB sessions) |
| @auth/prisma-adapter | 2.11.3 | |
| ai | 7.0.79 | Vercel AI SDK |
| @openrouter/ai-sdk-provider | 3.0.0 | |
| @google/genai | 2.19.0 | Direct Gemini |
| vitest | 4.x | |

### Three environment facts that will bite you

**A. Prisma 7 moved the connection config.** `prisma/schema.prisma` has **no `url`** in its datasource. Connection lives in `prisma.config.ts` (CLI only), and `PrismaClient` needs an explicit `PrismaPg` driver adapter.
```ts
import { db } from "@/lib/db/client";   // ✅ always
// ❌ never: new PrismaClient()
```

**B. Next 16 renamed `middleware.ts` → `proxy.ts`** and runs it on the Node runtime — which removes the old Auth.js edge/Prisma split-config workaround.

**C. OpenRouter serves ZERO embedding models.** Verified against its live `/api/v1/models` catalog. It is chat-completions only. **Embeddings must call Gemini directly.** RAG is P0 and blocks two features — an agent that assumes otherwise loses hours.

### Architecture decisions (locked with the user)

| Decision | Choice |
|---|---|
| Database | Neon Postgres + pgvector |
| File storage | UploadThing (originals never in the relational DB) |
| LLM generation | OpenRouter primary (`google/gemini-3.7-flash`), direct Gemini as a second provider behind the same interface, switched by `AI_PROVIDER` |
| Embeddings | **Gemini direct — forced**, see (C) above |
| Failure mode | **Live API only — no mock provider.** User's explicit decision. |

**On live-API-only:** I flagged that PRD §6.2 lists LLM failure during the live demo as a top risk. The user's call stands and no mock provider exists or should be built. The sanctioned mitigation is `scripts/warm-demo.ts` (Phase 8), which pre-generates the demo officer's data as **real rows in Postgres** so the demo renders from the database if the API is down. That's real data, not a fake.

---

## 4. What was built (Phases 1–3)

### Phase 1 — Foundation
Next 16 + TS + Tailwind 4 + shadcn scaffold in place. **Complete Prisma schema for all 8 phases** (not just 1–3), init migration with `CREATE EXTENSION vector` and two hand-written HNSW indexes. Auth.js v5 with Credentials + JWT sessions, `proxy.ts` route protection, `requireRole`/`requireRoleApi` RBAC helpers. Seed data: 4 domains, 33 competencies, an acyclic prerequisite DAG (26 edges), 5 departments, 5 roles with genuinely distinct target vectors, 3 demo users. Full "Caliper" design system + 7 primitives.

### Phase 2 — Competency Engine
The AI adapter (`AiProvider` interface, OpenRouter + Gemini implementations, typed `AiError`). `src/lib/engines/competency.ts` — pure, deterministic. Diagnostic generation (LLM writes questions, engine scores them). Assessment runner UI + results screen. `EvidenceDrawer` wired to real DB rows.

### Phase 3 — Skill Gap Engine
`src/lib/engines/gap.ts` with exact severity thresholds. LLM gap reasoning in a **separate** module (`src/lib/gap-reasoning/`, deliberately outside `lib/engines/`), generated *after* severity is fixed, with a deterministic template fallback. Learner gap dashboard + the "How is this calculated?" disclosure.

### What I verified myself (not taken on trust)

I re-derived the math independently rather than trusting test names:

- **Weight renormalization is exact.** Assessment + prior training, no history: `100 × (0.60×0.6875 + 0.25×0.2357) / 0.85 = 55.461831` vs engine `55.46183118810341`. Match to 1e-9. **Corollary that matters:** a perfect assessment with no other evidence yields level **5**, not a diluted 3 — the exact failure mode the spec prevents.
- **Evidence contributions sum to the displayed score** — 55.461831 both ways across 4 rows. The `EvidenceDrawer` structurally cannot display numbers that don't add up.
- **DAG relevance is pure set-overlap:** direct 1.0, one-hop 0.5 (both directions), two-hop 0, unrelated 0.
- **Every gap severity boundary is exact and inclusive on the correct side:** 3.0→CRITICAL but 2.9999→HIGH; 2.0→HIGH but 1.9999→MEDIUM; 1.0→MEDIUM but 0.9999→LOW. The CRITICAL override fires at exactly `roleWeight ≥ 0.9 AND gapSize ≥ 2`, declines at 0.89 or gapSize 1.
- **Null handling:** unmeasured competencies land in `unknown`, never in `gaps` as a fabricated CRITICAL. Zero-size gaps are excluded entirely.
- **Determinism:** 500 identical runs, byte-identical output.
- **Security:** no `correctAnswer` reaches any client component (grepped every `"use client"` file); no `NEXT_PUBLIC_` secrets; all API routes enforce server-side RBAC.
- **Engine purity:** planted a violating import — both ESLint and the architecture test caught it.

### One bug I found and fixed

Phase 3 added `@@unique([userId, competencyId])` to `SkillGap` in the schema, but it **never reached the migration SQL** — the upsert in `loadGapAnalysis` would have failed at runtime against a real database. Confirmed the drift with `prisma migrate diff`, added the index to the init migration (safe — nothing is applied anywhere yet), re-diffed: schema and migration now match exactly, with the two HNSW statements as the only intentional difference (Prisma's schema language can't express them).

### One disclosure

During Phase 2 the agent accidentally deleted `src/lib/validation/auth.ts` (untracked, unrecoverable via git) and reconstructed it from its call sites. I verified the reconstruction: both schemas present, sensible validation, single call site resolves, build clean. No loss — but you should know it happened.

---

## 5. Codebase map

```
src/
  app/
    (auth)/sign-in, sign-up              ✅ built
    (onboarding)/onboarding              ✅ scaffolded
    (learner)/dashboard, gaps,
              assessment/[id], new       ✅ built
             /path, /tutor, /courses     ⬜ Phases 6, 7
    (trainer)/trainer/documents          ⬜ Phase 4
    (admin)/admin/overview               ⬜ Phase 8
    api/
      auth/[...nextauth]                 ✅
      assessments/generate, [id]/submit  ✅
      competencies/[id]/evidence         ✅
      gaps                               ✅
      documents/[id]/process             ⬜ Phase 4
      questions/generate                 ⬜ Phase 5
      tutor  (streaming)                 ⬜ Phase 7
      uploadthing                        ⬜ Phase 4
    dev/                                 fixture routes — see below
  lib/
    ai/          types, errors, openrouter, gemini, provider   ✅ (streamText stubbed)
    engines/     competency.ts ✅  gap.ts ✅
                 recommendation.ts ⬜  learning-path.ts ⬜
    gap-reasoning/  ✅  (LLM reasons — outside engines/ on purpose)
    assessment/     ✅  generate-diagnostic.ts
    rag/            ⬜  Phase 4: chunk, embed, retrieve
    auth/ db/ validation/  ✅
  components/
    caliper/     10 primitives ✅  (3 more in Phases 6–7)
    ui/          shadcn
prisma/   schema (all phases) + init migration + seed  ✅
tests/    engines/ + architecture/  — 47 passing
docs/     reference documents
```

**The `/dev/` fixture pattern** — how UI gets built and visually verified without a live database. `/dev/caliper`, `/dev/assessment`, `/dev/assessment-results`, `/dev/gaps` exist; `src/app/dev/layout.tsx` `notFound()`s them in production. **Follow this pattern** for Phases 4–8.

### Caliper primitives — reuse, do not create variants

Built: `caliper-gauge`, `score-readout`, `domain-matrix`, `gap-card`, `gap-dashboard`, `evidence-drawer`, `evidence-drawer-live`, `severity-formula-disclosure`, `ai-error-state`, `processing-state`.

Still to build: `PathTimeline` (Phase 6), `ReasonBreakdown` (Phase 6), `SourceChunkCard` (Phases 5 & 7).

### Design system — "The Caliper"

Measurement-instrument aesthetic: calipers, gauges, calibration ticks. Grounded in statistics as a discipline of measurement and confidence ranges, not false-precision percentages.

Tokens (OKLCH, `@theme` in `globals.css`, mapped onto shadcn variable names so shadcn inherits automatically): `--color-measure` (primary/known), `--color-target` (teal/on-track), `--color-gap` (amber-red), `--color-critical`, `--color-unmeasured`. Light = cool paper; dark = warm charcoal.

Type: **Archivo** (UI) + **IBM Plex Mono** for all numerals with `font-variant-numeric: tabular-nums` (`.tabular-mono`) so gauge readouts don't jitter. Radius 2–6px only — instruments are precise, not pillowy. Motion ≤200ms, transform/opacity only, full `prefers-reduced-motion`.

---

## 6. Reference documents — read before coding

| File | When |
|---|---|
| **`RestPlan.md`** | **Your work order — Phases 4–8, with formulas and acceptance criteria.** |
| `docs/engine-specifications.md` | **Normative.** Exact formulas for all four engines. §3–4 cover Phase 6. |
| `docs/pgvector-prisma-notes.md` | **Before writing any vector code.** Every item is a bug someone already hit. |
| `docs/course-catalog-research.md` | ~82 real iGOT/NSSTA courses — Phase 6 seed data. |
| `PRODUCT.md` | Brand, voice, design direction. |
| `SIH Planning and Preparation (1).pdf` | The v4.0 PRD — **source of truth**. |
| `SIH Planning Draft.md` | Superseded v2.0. Historical only — don't build from it. |

### Two research findings worth knowing about

**The course catalog is real, not mock.** `docs/course-catalog-research.md` contains ~82 courses transcribed from *official* MoSPI documents — the NSSTA Advance Training Calendar FY2025-26 and the NSSTA iGOT SADHANA Saptah office memorandum — including genuine `portal.igotkarmayogi.gov.in` URLs. Both were scanned image PDFs that text extraction couldn't read; they were read visually. The PRD had planned a "clearly labelled mock dataset," so **this is an upgrade** — when a judge asks whether recommendations point anywhere real, the answer is yes. Don't fabricate deep links that would 404 in a live demo.

**pgvector has four non-obvious rules** (all in `docs/pgvector-prisma-notes.md`): bind a *string* not a JS array (`pgvector.toSql()`), always `SELECT embedding::text`, cast `::vector` on both sides, and use `<=>` only (must match the `vector_cosine_ops` index). Plus the silent one: **`gemini-embedding-001` does not auto-normalize below 3072 dims** — skip manual L2 normalization and cosine similarity goes subtly wrong while still returning plausible-looking results. There's also a Prisma 7 migration-drift bug ([prisma#28867](https://github.com/prisma/prisma/issues/28867)) — closed, fixed in 7.2.0, and we're on 7.10.0 with dimensions declared explicitly, so we're clear.

---

## 7. Before anything can be verified end-to-end

**⚠️ Nothing in this project has ever run against a real database or a live model.** Phases 1–3 were verified as pure logic, types, and UI against fixtures. That verification is genuine and rigorous — but it is not the same as end-to-end.

**The user must provide:**

1. **Neon Postgres** — create project, set `DATABASE_URL` in `.env`, then in the Neon SQL editor:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
   (pgvector is on all Neon plans; the extension is named `vector`, not `pgvector`.)
2. **Apply + seed:**
   ```bash
   pnpm db:deploy && pnpm db:seed
   ```
   Demo logins: `learner@` / `trainer@` / `admin@skillforge.demo`, password `SkillForge!2026`.
3. **`OPENROUTER_API_KEY`** (generation) and **`GEMINI_API_KEY`** (**required** — embeddings can't use OpenRouter).
4. **`UPLOADTHING_TOKEN`** for Phase 4.

**Known-unverified paths inherited from Phases 1–3** — exercise these once a DB exists:
- `loadGapAnalysis` Postgres joins (`RoleCompetency`/`UserCompetency`/`DepartmentPriority`) and the `SkillGap` upsert
- Assessment submit route's prior-attempt lookback and evidence dedup-on-resubmit
- Live AI-generated gap reason text (only the deterministic fallback has run)
- Any live LLM call at all

---

## 8. The Golden Demo Flow — the actual evaluation criterion

PRD §5.3. All 12 steps must work **live, end-to-end, for one officer**:

1. Officer logs in, profile complete
2. System maps role → required competencies
3. Diagnostic assessment measures current competency
4. Skill Gap Engine identifies and prioritizes gaps
5. Recommendation Engine surfaces iGOT + NSSTA entries
6. Learning Path Engine produces an ordered pathway
7. Officer asks the AI Tutor a grounded question
8. Trainer uploads a document, generates and reviews MCQs
9. Officer completes the quiz, gets instant feedback
10. **Competency score updates from the new evidence, visibly**
11. Platform recommends the next step
12. Administrator sees department-level gaps

Steps 1–6 and 10–12 become reachable once Phases 4–6 land. **Protect that core path first** — PRD §6.2 notes it demonstrates the full closed loop even if the tutor (7) or MCQ generator (5) slip.

---

## 9. Working agreements

- **Definition of done per phase:** `pnpm build`, `pnpm lint`, `pnpm test` all pass; new engine code has tests for 100-run determinism, exact threshold boundaries, null propagation, and evidence-sums-to-score; the architecture boundary test still passes; UI verified **by you** in both themes.
- **Verify your own work.** Use the Browser MCP tools against `pnpm dev`. Don't ask the user to check what you can check yourself.
- **Never invent a connection string or API key.** If something can't be verified without one, say so plainly rather than claiming it works.
- **Nothing is committed yet.** The repo has one initial commit; all ~19 paths are untracked. Commit only when the user asks.
- **Report honestly.** If a test fails, say so with the output. If a step was skipped, say that. The user is making decisions based on your reports.

---

## 10. Phase status at a glance

| Phase | Focus | Status |
|---|---|---|
| 1 | Auth/RBAC, data model, taxonomy + prerequisite DAG, design system | ✅ **Complete, verified** |
| 2 | Competency Engine + diagnostic generation + assessment runner | ✅ **Complete, verified** |
| 3 | Skill Gap Engine + severity + reasoning + gap dashboard | ✅ **Complete, verified** |
| 4 | Document pipeline: upload → chunk → embed (pgvector) → storage | ⬜ **Next. Blocks 5 and 7.** |
| 5 | MCQ Generator (RAG-grounded) + Assessment Engine feedback loop | ⬜ |
| 6 | Recommendation + Learning Path Engine (seeded catalog) | ⬜ |
| 7 | AI Tutor (retrieval + grounded response + refusal rule) | ⬜ |
| 8 | Dashboards (Learner/Trainer/Admin), audit, warm-demo, polish | ⬜ |
