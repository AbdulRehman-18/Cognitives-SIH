# Implementation Plan — Closing the Problem-Statement Gaps (PS 26101)

> **Status (2026-09-23): all phases implemented.** Migrations `20260923000000`–`20260923000200` applied. Engines added: `analytics.ts`, `adaptive.ts` (106 tests passing). Run `pnpm db:seed-demo` for the synthetic analytics cohort (`@cohort.skillforge.demo`, no sign-in).
>
> | Phase | Where it lives |
> |---|---|
> | 0 | `src/lib/competency/recompute.ts` — the single score writer; hints persisted on `QuizAnswer` |
> | 1 | `src/lib/igot/*`, `/api/igot/*`, admin Settings → iGOT, path/courses enrol controls, `vercel.json` cron |
> | 2 | `retrieveForUser` (privacy scope), `learnerDocument` upload, `/api/tutor/quiz` (SELF_EVAL), Tutor → My study material |
> | 3 | `src/lib/profile/training-records.ts`, onboarding background + trainings + iGOT import, Profile → Background / Training record |
> | 4 | `src/lib/analytics/load-analytics.ts`, `/admin/effectiveness`, `/admin/forecast`, overview heatmap |
> | 5 | `src/lib/auth/sso.ts` (env-enabled `gov-sso` OIDC + Google) |
> | 6 | Hindi tutor/quiz + `src/i18n` UI; `src/lib/rag/transcribe.ts` (audio/video/captions); `/lab` (Pyodide); adaptive diagnostic (`/api/assessments/[id]/next`) |
>
> Deviation from the plan: enrolment state is read from `LearningProgress`, not `Recommendation.status` — recommendations are regenerated on every page load, so a status stored there would not persist.

Scope: the gaps found when auditing SkillForge AI against SIH problem statement 26101 (MoSPI / DIID). Ordered by judging impact. Every phase keeps the project's core rule: **the LLM never decides a number** — scores, gaps, effectiveness and forecasts come from pure functions in `src/lib/engines/`, which must never import `src/lib/ai`.

| # | Phase | Closes | Effort |
|---|---|---|---|
| 0 | Shared foundation (schema + recompute service) | prerequisite for 1–4 | 1 day |
| 1 | iGOT Karmayogi integration + progress → scores | "Seamless iGOT integration", learning hours | 3 days |
| 2 | Learner self-evaluation grounded in uploaded material | "MCQs/quizzes from uploaded content … self evaluation" | 2 days |
| 3 | Complete competency profile + prior trainings | "profile from designation, education, experience, assignment, previous trainings" | 1.5 days |
| 4 | Admin analytics: effectiveness, distribution, forecast | "training effectiveness … predictive analytics" | 2 days |
| 5 | SSO | "Single Sign-On" | 1 day |
| 6 | Hindi, video transcripts, virtual lab, adaptive assessment | multilingual, videos, virtual labs, adaptive | 3–4 days (pick by time left) |

Effort assumes one developer; phases 2, 3 and 5 can run in parallel with 1 once phase 0 lands.

---

## Phase 0 — Shared foundation

### 0.1 One migration for all schema changes
Doing it once avoids migration churn across parallel branches.

```prisma
enum DocumentScope { SHARED PERSONAL }          // Phase 2
enum PriorTrainingSource { SELF_DECLARED IGOT } // Phase 3

model Document {
  // + existing fields
  scope     DocumentScope @default(SHARED)  // trainer uploads stay SHARED
  fileName  String?
  @@index([ownerId, scope])
}

model Course {
  // + existing fields
  externalId   String?   @unique   // iGOT course identifier
  lastSyncedAt DateTime?
}

model LearningProgress {
  // + existing fields
  course               Course?   @relation(fields: [courseId], references: [id])
  enrolledAt           DateTime?
  completedAt          DateTime?
  externalEnrolmentId  String?
  @@unique([userId, courseId])
}

model OfficerProfile {
  // + existing fields
  currentAssignment String?
}

model PriorTraining {                               // Phase 3
  id            String              @id @default(cuid())
  userId        String
  user          User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  title         String
  provider      String?
  completedAt   DateTime
  competencyIds String[]
  source        PriorTrainingSource @default(SELF_DECLARED)
  createdAt     DateTime            @default(now())
  @@index([userId])
}

model GapSnapshot {                                 // Phase 4
  id           String      @id @default(cuid())
  takenAt      DateTime    @default(now())
  departmentId String?
  competencyId String
  severity     GapSeverity
  count        Int
  @@index([competencyId, takenAt])
}

enum AssessmentType { DIAGNOSTIC STANDARD POST_LEARNING SELF_EVAL } // Phase 2
```

### 0.2 Extract a single recompute service
Scoring today happens inline in `src/app/api/assessments/[id]/submit/route.ts`, and it passes `priorTrainings: []` (see the NOTE there). Course completions and self-declared trainings both need to feed that slot, so move the logic into one place:

- **New:** `src/lib/competency/recompute.ts`
  - `recomputeUserCompetency(userId, competencyId)` gathers **source records** fresh each time. It never rebuilds from the collapsed `CompetencyEvidence` rows, which would double-count:
    - assessment answers: latest attempt → `AssessmentAnswerInput[]`
    - history: prior attempts → `AssessmentHistoryInput[]`
    - trainings: `PriorTraining` rows + `LearningProgress` rows with `status = COMPLETED` → `PriorTrainingInput[]`, with `relevance` from the existing `computeRelevance()` and `monthsSince` from `completedAt`
  - Calls `scoreCompetency()`, upserts `UserCompetency`, then rewrites that competency's evidence rows (`ASSESSMENT`, `PRIOR_TRAINING`, `COURSE_COMPLETION`).
  - `recomputeGapsAndRecommendations(userId)` reruns the gap engine and recommendation loader, then writes a `GapSnapshot` (Phase 4).
- The submit route calls the service instead of doing it inline, with no behaviour change for assessments. The existing engine tests must still pass.

**Done when:** the submit route is thinner, all 85 tests pass, and there's a new unit test showing that a completed course raises a competency's score with a `COURSE_COMPLETION` evidence row.

---

## Phase 1 — iGOT Karmayogi integration (highest priority: it's in the PS title)

Karmayogi's public APIs need partner onboarding, so build a **real adapter interface** with a **mock implementation** that is honest about being a mock. It gets switched to live by configuration, not by rewriting code.

### 1.1 Adapter — `src/lib/igot/`
- `types.ts`: an `IgotClient` interface
  - `listCourses(opts?)` → catalog entries (externalId, title, provider, competencies, duration, url, language)
  - `getUserProfile(igotUserId)` → designation, department, completed courses (feeds Phase 3 prefill)
  - `enrol(userId, externalCourseId)` → enrolment id
  - `getProgress(userId)` → per-course `{status, progressPct, completedAt}`
- `mock-client.ts`: backed by `prisma/course-catalog.ts` plus the `LearningProgress` table. Progress is advanced explicitly (see 1.4), never randomly, so demos can be repeated.
- `http-client.ts`: a real REST client (`IGOT_API_BASE`, `IGOT_API_KEY`) with the same interface.
- `index.ts`: `getIgotClient()` picks by `IGOT_MODE=mock|live` (default `mock`).

### 1.2 Catalog sync
- `POST /api/igot/sync-catalog` (ADMIN): upserts `Course` rows by `externalId`, sets `lastSyncedAt`, and embeds new or changed courses. Move the embedding loop from `scripts/embed-courses.ts` into `src/lib/rag/embed-courses.ts` so both the script and the route use it.
- Admin Settings page: a "Sync iGOT catalog" button showing last sync time and counts added/updated.

### 1.3 Enrolment
- `POST /api/igot/enrol` (LEARNER): `{courseId}` → `client.enrol()` → upserts `LearningProgress` (`IN_PROGRESS`, `enrolledAt`), and sets the matching `Recommendation.status = ACCEPTED`.
- Path and courses pages: an "Enrol on iGOT" button on each item, then a status chip (Enrolled · 40% · Completed) and a deep link to the course on iGOT.

### 1.4 Progress sync → competency update
- `POST /api/igot/sync-progress` (the learner themselves, or cron with `CRON_SECRET`): `client.getProgress()` → updates `LearningProgress`. On a new `COMPLETED`, it calls `recomputeUserCompetency` for each competency the course targets, then `recomputeGapsAndRecommendations`, and marks the recommendation `COMPLETED`. Everything is logged to the audit log.
- `vercel.json`: a nightly cron hitting `sync-progress` for all enrolled users.
- Mock-only demo control: in `IGOT_MODE=mock`, the path page shows a clearly labelled **"Simulate iGOT completion"** action. It's hidden in live mode.

### 1.5 Learner dashboard additions
- **Learning hours:** sum of `course.durationHours × progressPct` across `LearningProgress`.
- **Progress:** enrolled / in-progress / completed counts, path completion percentage.
- Evidence drawer already renders `COURSE_COMPLETION`, so no UI change is needed there.

**Done when:** a learner enrols on a recommended course, simulates completion, and sees the targeted competency score rise, the gap shrink or close, a `COURSE_COMPLETION` row in the evidence drawer, the recommendation marked completed, and learning hours updated. All of it is driven by the engine, with no LLM involved.

---

## Phase 2 — Learner self-evaluation from uploaded material

Today `/api/tutor/quiz` generates from general LLM knowledge and tells the model *not* to reference documents, so it doesn't meet "MCQs from uploaded learning materials". Trainers keep their role (the PS names them); learners get **private** uploads for self-evaluation.

### 2.1 Personal uploads
- UploadThing (`src/app/api/uploadthing/core.ts`): add a `learnerDocument` route (LEARNER only, smaller size limit) that creates `Document{scope: PERSONAL, ownerId}`. The trainer route stays `SHARED`.
- `src/app/api/documents/*`: learners can list, process and delete **only their own** `PERSONAL` documents. Trainers keep their current access.
- Tutor page: a "My materials" panel (upload, processing status, delete).

### 2.2 Scoped retrieval (privacy-critical)
- Replace `retrieveAcrossAllDocuments` with `retrieveForUser(query, userId, k, {documentId?})`, filtered to `READY AND (scope = 'SHARED' OR ownerId = userId)`, optionally narrowed to one document.
- Switch `src/app/api/tutor/route.ts` to it. Without this change, the first personal upload would leak into every other learner's tutor answers.

### 2.3 Grounded quiz
- `POST /api/tutor/quiz`: `{topic, documentId?, count}` → `retrieveForUser` → reuse `generateMcqQuestions` (`src/lib/questions/generate-mcq.ts`) with the retrieved chunks. Each question must cite a chunk id **from the retrieved set**; drop questions that don't. If the best similarity is below the tutor's threshold, refuse ("not covered by your material") rather than generate.
- Save as `Assessment{type: SELF_EVAL}` + `QuizAttempt` for learner history. **Self-eval attempts never feed `recomputeUserCompetency`**: official scores only come from trainer-approved assessments. This is a stated rule, not a gap.
- `quiz-runner.tsx`: choose a source ("All course material" / a personal document); after each answer, show the explanation, the cited source chunk (reuse `SourceChunkCard`), and a feedback line naming the concept to revisit.

**Done when:**
- every quiz question cites a chunk from the chosen source;
- an off-material topic is refused;
- a vitest test shows learner A's retrieval never returns learner B's chunks;
- self-eval attempts leave `UserCompetency` unchanged.

---

## Phase 3 — Complete competency profile

### 3.1 Onboarding
- `src/lib/validation/onboarding.ts` + `onboarding-form.tsx`: add education (select: Graduate / Postgraduate / PhD, plus field of study), years of experience, current assignment, and a **previous trainings** repeater (title, provider, month/year, competencies multi-select from the framework).
- `src/app/(onboarding)/actions.ts`: write `OfficerProfile` + `PriorTraining` rows, compute `completeness`, then call `recomputeUserCompetency` for the competencies touched. Declared trainings contribute through the engine's existing `priorTraining` term (weight 0.25, with recency decay). They can never set a score alone, because the assessment term dominates.
- "Import from iGOT" button: `client.getUserProfile()` prefills designation and department, and adds completed iGOT courses as `PriorTraining{source: IGOT}`. This covers "automatically create a comprehensive competency profile".

### 3.2 Profile page
- Learner profile: edit these fields later, and list prior trainings with their source badges. Every edit triggers a recompute.

**Done when:** a new officer with a declared "Python for Data Analysis" training (8 months ago) gets a non-null Python score with LOW confidence, and the evidence drawer shows the `PRIOR_TRAINING` row with its relevance and decay.

---

## Phase 4 — Admin analytics

All numbers come from a new pure engine, `src/lib/engines/analytics.ts`, with unit tests. An LLM may only write a narrative summary from numbers it is given (same pattern as `gap-reasoning/generate-reason.ts`).

### 4.1 Training effectiveness
- For each course and competency: completions, completion rate (completed / enrolled), mean score **before** enrolment vs **after** completion (from `UserCompetency.evidenceJson` history), mean delta, and hours invested.
- Admin page `/admin/effectiveness`: a ranked table plus a "delta per hour" view. Courses with fewer than 3 completions are marked "insufficient data", never ranked.

### 4.2 Competency distribution
- A heatmap of department × domain (average score, share assessed), plus level histograms per competency. Added to `/admin/overview`.

### 4.3 Predicted future needs
- `GapSnapshot` rows are written on every gap recompute (Phase 0) and backfilled from the seed.
- Forecast: a least-squares linear trend per competency over monthly snapshot counts, projected 2 quarters ahead, multiplied by `DepartmentPriority` weight. Competencies tagged as emerging (AI/ML, Cloud Computing, Cybersecurity, Data Privacy, GIS, APIs) are flagged.
- `/admin/forecast`: projected shortage ranking with the formula shown (same "show the rule" pattern as the gap engine), plus a recommended cohort training plan: top forecast gaps × best-effectiveness courses from 4.1.

**Done when:**
- `analytics.ts` has unit tests for effectiveness, trend and forecast;
- the pages render from seed data;
- the page states the forecast formula;
- no number on these pages comes from the LLM.

---

## Phase 5 — Single sign-on

- `src/lib/auth/config.ts`: add a generic OIDC provider (`id: "gov-sso"`, `issuer`/`clientId`/`clientSecret` from env), which is how Parichay/Jan Parichay would plug in. Add Google as the demo provider. Keep `session.strategy: "jwt"` (required by Credentials).
- First SSO login creates a `User{role: LEARNER}` and redirects to onboarding. Roles are assigned by admins, never taken from the identity provider.
- Enable the "Sign in with SSO" button only when a provider's env vars are set; otherwise keep "Coming soon".
- No `allowDangerousEmailAccountLinking`.

**Done when:** a Google login creates a learner, lands on onboarding, and `proxy.ts` / `requireRole` behave the same as for credentials users.

---

## Phase 6 — Remaining gaps (do in this order, as time allows)

1. **Hindi for tutor and quiz** (0.5 day, high visibility): a language toggle passes `language: "hi"`; prompts answer in Hindi while keeping citations. Catalog Hindi courses get a language badge, and recommendations can prefer the learner's language.
2. **Hindi UI strings** (1 day): a cookie-based dictionary (`src/i18n/{en,hi}.ts`) for the learner shell, nav and dashboard. This avoids restructuring routes by locale.
3. **Video/audio material** (1 day): accept short mp4/mp3 uploads, transcribe with Gemini audio understanding, and feed the transcript into the existing chunk → embed pipeline (`src/lib/rag/pipeline.ts`). Cap duration to stay inside Vercel's 60s `maxDuration`. For longer media, accept a transcript or captions file.
4. **Virtual lab** (1–1.5 days): an in-browser Python lab (Pyodide) and SQL lab (sql.js) with exercises tagged to the Python/SQL competencies and auto-checked outputs. Practice only; doesn't change official scores.
5. **Adaptive diagnostic** (1 day): a deterministic item selector. The next question's difficulty steps up after a correct answer and down after a wrong one, stopping when the confidence band reaches MEDIUM.

---

## Cross-cutting

- **Env vars to add:** `IGOT_MODE`, `IGOT_API_BASE`, `IGOT_API_KEY`, `CRON_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `GOV_SSO_ISSUER`, `GOV_SSO_CLIENT_ID`, `GOV_SSO_CLIENT_SECRET`. Update `.env.example` and the Vercel project.
- **Seed:** add enrolments/completions, prior trainings and 6 months of `GapSnapshot` history, so every new page has data on first run.
- **Audit log:** enrol, completion sync, catalog sync, personal upload and SSO account creation.
- **Tests:** engines (analytics, recompute), retrieval scoping, RBAC on every new route.
- **Principle check:** `grep -r "lib/ai" src/lib/engines` must stay empty.

## Demo script this plan enables (≈4 min)

1. An officer signs in with SSO → onboarding imports their iGOT profile and prior trainings → the competency profile appears with confidence bands.
2. Diagnostic → gaps with visible formulas → recommendations from iGOT and NSSTA with reason breakdowns.
3. Enrol on iGOT → simulate completion → score rises and the gap closes, with evidence shown.
4. The learner uploads their own PDF → a cited self-evaluation quiz with instant explanations → asks the tutor the same question in Hindi.
5. The trainer uploads NSSTA material → generated MCQs → reviews and publishes them to learners.
6. Admin → workforce heatmap → training effectiveness → forecast of emerging skill shortages with a recommended cohort plan.
