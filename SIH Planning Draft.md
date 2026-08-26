# SkillForge AI — Product Requirements Document

**Problem Statement:** SIH26101 | **Organization:** MoSPI — Data Informatics & Innovation Division (DIID)
**Version:** 2.0 | **Date:** August 2026 | **Prepared for:** Smart India Hackathon 2026

---

## 1. Document Basics

**Purpose of this document:** Define what SkillForge AI must do, for whom, and how — precise enough to guide implementation and to survive changes to the system without losing coherence.

**Owner:** Abdul Rehman, Team Lead
**Status:** Draft for hackathon build phase
**Source of truth:** Official Problem Statement 26101 (MoSPI/DIID), Theme: Smart Education

**Related documents:** SkillForge AI Pitch Brief, System Architecture Diagram, User Flow Diagram

**Revision notes:** v2.0 incorporates the full official problem statement (competency domains, NSSTA TPAC, SSO/RBAC) and expands scope from the original pitch-stage draft into a complete build reference.

---

## 2. Problems and Goals

### 2.1 The Problem

Officials in India's Official Statistical System have access to a large training catalog (iGOT Karmayogi) but no mechanism to determine which courses are relevant to their specific role and skill level. Training is generic, competency is unmeasured, and course selection is left to guesswork. The result: low training relevance, weak adoption, and no visibility into workforce readiness for modern statistical methods (AI/ML, GIS, cloud, digital governance).

### 2.2 Goals

- Give every officer an accurate, structured picture of their own competency across four defined domains
- Surface only the training that closes a real, measured gap — not a generic catalog
- Let trainers turn any document into a working assessment in minutes, not hours
- Give administrators organization-wide visibility into workforce readiness

### 2.3 Non-Goals (explicitly out of scope for this build)

- Replacing iGOT Karmayogi as a course host — SkillForge is a competency layer on top of it, not a competitor
- Live production HRIS/SSO integration — architected for it, not delivered in the hackathon window
- Full multilingual support, virtual labs, AI chat tutoring — acknowledged in the official problem statement as platform ambitions, not part of the MVP

### 2.4 Success Metrics

- An officer can go from sign-in to a readable gap report in under 3 minutes
- A trainer can generate a 10-question quiz from an uploaded document in under 30 seconds
- An admin can see organization-wide domain coverage in one screen, no drill-down required for the summary view

---

## 3. Users and Scope

### 3.1 Personas

**Learner — Statistical Officer**
Mid-career MoSPI official (Survey Design, National Accounts, Price/Labour/Agricultural/Industrial Statistics roles, etc.). Time-constrained, not necessarily comfortable with modern software UI, wants clear direction rather than a catalog to browse. Primary need: "tell me what I actually need to learn, and where to get it."

**Administrator — Training Manager / DIID Coordinator**
Oversees training effectiveness across a team or department. Needs aggregate visibility, not individual micromanagement. Primary need: "where are our collective gaps, and is training closing them."

**(Future) Super Admin — System Administrator**
Manages framework configuration and system settings. Out of MVP scope; included in data model so it isn't a redesign later.

### 3.2 Scope Table

| In Scope (MVP) | Out of Scope (Future) |
|---|---|
| Competency profile creation | HRIS auto-sync |
| Skill-gap analysis against the official framework | Live SSO (SAML/OAuth enterprise) |
| Course recommendations (iGOT — seeded dataset) | Live iGOT API integration |
| AI-generated quizzes from uploaded documents | NSSTA TPAC integration |
| Learner dashboard | Multilingual UI |
| Admin dashboard (team-level) | AI virtual assistant / chat tutor |
| Role-based access (Learner/Admin) | Virtual labs |
| Light/dark theme | Predictive analytics |

---

## 4. Features and Requirements

### 4.1 Authentication & Access

- Email/password sign-in via NextAuth.js, session-based, role stored on the user record (Learner / Admin)
- Architecture reserves a slot for SSO (SAML/OAuth) — not built, but the auth layer doesn't need to be rebuilt to add it later
- **Acceptance criteria:** an unauthenticated user cannot reach any dashboard route; role determines which dashboard renders after sign-in

### 4.2 Competency Profile (Onboarding)

Full onboarding flow detailed in Section 5.4. Functionally:
- Captures Designation, Department, Job Role, Years of Experience, Education, Previous Trainings
- Profile is editable after creation, not a one-time form
- **Acceptance criteria:** a profile is usable (produces a gap report) even if only the required fields are filled; optional fields refine but don't block

### 4.3 Skill Gap Analysis

- Compares the officer's profile and any self-reported/assessed skill levels against the official four-domain competency framework (Section 5.3)
- Produces a per-domain measured range (not a bare percentage) and flags domains where the range falls short of the role's target
- **Acceptance criteria:** every domain in the framework appears in the report, even if unmeasured (shown as "not yet assessed," never left blank or omitted)

### 4.4 Course Recommendations

- For each flagged gap, surface 1-3 relevant courses from the seeded iGOT dataset, each with a stated reason tied to the specific gap
- **Acceptance criteria:** no course appears without a visible reason; no gap is left without at least one recommendation, even if a "closest match" caveat is shown

### 4.5 AI Quiz & MCQ Generation

- Upload PDF/PPT/DOC → text extraction → officer/trainer selects question count, difficulty, optional topic focus → Gemini API generates MCQs (question, 4 options, correct answer, explanation)
- Instant scoring and feedback on submission
- **Acceptance criteria:** generation completes within 25 seconds for a typical document (10-20 pages); a failed generation shows a clear retry path, never a silent failure

### 4.6 Learner Dashboard

- Competency snapshot, gap summary, recommended courses, recent quiz results, plain-language status line (no bare percentages as the headline figure)

### 4.7 Admin Dashboard

- Team-level competency coverage grid (officers × domains), training completion rates, exportable summary
- Visually distinct from the learner view (different accent treatment) so no one mistakes aggregate data for personal data

### 4.8 Non-Functional Requirements

| Category | Requirement |
|---|---|
| Security | Role-based access control; passwords hashed; API keys never exposed client-side |
| Performance | Quiz generation ≤ 25s; dashboard load ≤ 2s on typical connections |
| Reliability | Graceful, explicit error messages on LLM API failure — never a blank screen |
| Accessibility | Visible keyboard focus states; reduced-motion respected; sufficient contrast in both themes |
| Compliance | Data handling aligned with the Digital Personal Data Protection Act, 2023 |
| Scalability | Should hold up under a few hundred concurrent users without architectural changes |

---

## 5. Design and Technical Details

### 5.1 Architecture Summary

Full-stack Next.js 14 (App Router). API routes serve as the backend — no separate service. PostgreSQL via Prisma for persistence. NextAuth.js for auth. Gemini API called server-side for all AI features. File parsing (pdf-parse/mammoth) runs in-process. Hosted on Vercel (app) + Neon/Supabase (database). See the accompanying architecture diagram for the full component map, including the external-service boundary (Gemini, iGOT, NSSTA) and the authenticated-boundary line separating public sign-in from the rest of the system.

### 5.2 Core Data Model (entities, not full schema)

- **User** — id, email, password hash, role (Learner/Admin), linked Profile
- **CompetencyProfile** — designation, department, job role, experience, education, prior trainings, linked to User
- **SkillDomain** — the four fixed categories (Statistical / Technical / Digital Governance / Behavioural)
- **SkillItem** — individual named skills within a domain (e.g., "Survey Design" under Statistical), each with a defined proficiency scale
- **GapRecord** — per-officer, per-skill measured range + target range + flag status, timestamped
- **Course** — title, source (iGOT/NSSTA), tagged SkillItem(s), external link
- **Recommendation** — links a GapRecord to a Course with a stored reason string
- **QuizSet** — source document reference, generated questions, difficulty, created by
- **QuizAttempt** — officer, QuizSet, answers, score, timestamp

### 5.3 Competency Framework (seed data, from the official problem statement)

- **Statistical:** Survey Design, Sampling, National Accounts, Price Statistics, Labour Statistics, Agricultural Statistics, Industrial Statistics, SDG Indicators, Metadata Standards, Data Quality Frameworks
- **Technical:** Python, R, SQL, Stata, SPSS, SAS, GIS, Data Visualization, AI/ML, Cloud Computing, APIs, Open Data
- **Digital Governance:** Cybersecurity, Data Privacy, Digital Signatures, Government Cloud, Digital Public Infrastructure
- **Behavioural/Managerial:** Leadership, Communication, Project Management, Ethics, Decision Making, Change Management

This list is seeded directly into `SkillItem` records at setup — the AI compares a profile against structured data, never invents the framework at request time.

### 5.4 Onboarding Flow (researched and detailed)

Enterprise LMS research is consistent on one point: a single long intake form is where onboarding completion drops off. Best-performing systems use **progressive, role-aware profiling** — collect the minimum needed to produce a first useful result, then enrich the profile over time. That principle shapes this flow:

**Step 1 — Minimum viable profile (under 60 seconds):**
Designation, Department, Job Role. These three fields alone are enough to assign a default target-competency set for the officer's role and produce a *preliminary* gap snapshot — the officer sees value before any long form.

**Step 2 — Immediate partial value:**
Right after Step 1, show a preliminary Skill Gap Report using role-based defaults (not yet personalized by experience/education). This mirrors the research finding that role-specific defaults let a platform be useful before full data entry is complete.

**Step 3 — Progressive enrichment (optional, prompted contextually, not forced):**
Years of Experience, Education, Previous Trainings — requested as short, separate prompts surfaced later (e.g., "Add your prior training history to refine your recommendations"), not bundled into the first screen. Each addition re-runs the gap analysis and visibly improves the report's precision, giving the officer a reason to complete it.

**Step 4 — Sign-in method:**
Email/password for the hackathon build; the flow reserves a visible-but-inactive "Sign in with SSO" option so the eventual enterprise auth swap doesn't change the screen layout.

**Step 5 — First real action:**
Immediately after the preliminary report, the officer is routed to one clear next action — their single most significant flagged gap and its recommended course — rather than a dashboard with many equally-weighted options. This matches the "one clear job per screen" principle established for the whole product.

This staged approach is deliberately original to SkillForge rather than copied from a specific competitor's onboarding screens — it's assembled from the general pattern enterprise LMS research consistently supports (progressive profiling, role-based defaults, immediate partial value), applied to this platform's specific data (the four-domain framework).

### 5.5 Visual Design Direction

"The Caliper" — a measurement-instrument aesthetic (calipers, gauges, calibration marks) grounded in statistics as a discipline of measurement and confidence ranges, not false-precision percentages. Grotesk sans (Archivo/Public Sans) for UI, monospaced tabular numerals (IBM Plex Mono) for all scores and gauge labels. Cool paper background tone in light mode, warm charcoal in dark mode, with a working toggle. No gamification — no streaks, XP, or celebratory effects; language stays plain and non-judgmental throughout (a gap is framed as room to grow, never a deficiency score).

---

## 6. Planning and Risks

### 6.1 Build Phases

| Phase | Focus |
|---|---|
| 1 | Auth, data model, profile onboarding flow |
| 2 | Competency framework seed data, gap analysis logic |
| 3 | Course recommendation matching (seeded dataset) |
| 4 | Quiz generation pipeline (upload → extract → generate → score) |
| 5 | Learner + Admin dashboards, visual design pass |
| 6 | QA, demo-data seeding, presentation rehearsal |

### 6.2 Risks and Mitigations

| Risk | Mitigation |
|---|---|
| iGOT Karmayogi API inaccessible in hackathon window | Seeded representative course dataset, architected for live API swap later |
| LLM API failure during live demo | Pre-tested cached document/quiz result as fallback; explicit error states, never a blank screen |
| Competency framework treated as too rigid or incomplete | Framework is seed data, not hardcoded logic — new skills/domains can be added without a redesign |
| Scope creep toward gamification or generic dashboard patterns | Explicit non-goals section (2.3) and locked design direction (5.5) to hold the line under time pressure |
| Onboarding drop-off | Progressive profiling flow (5.4) instead of one long form |

### 6.3 Assumptions and Dependencies

- Gemini API access remains available and within free/trial usage limits through the hackathon window
- Course dataset is illustrative/representative, not the full live iGOT catalog
- Evaluation is based on a working demo of the three core jobs (measure, recommend, assess), not full enterprise-readiness
