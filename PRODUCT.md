# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
Next.js 14+ (App Router) with TypeScript, PostgreSQL (Prisma), NextAuth, and Gemini API

## Users
- **Primary Learner (Statistical Officer):** Mid-career MoSPI official across statistical divisions (Survey Design, National Accounts, Price/Labour/Agricultural/Industrial Statistics). Time-constrained, seeking clear gap diagnosis and direct training routes rather than generic catalog browsing.
- **Administrator (Training Manager / DIID Coordinator):** Oversees workforce readiness and training effectiveness across statistical divisions/teams. Requires aggregate domain coverage views without micromanaging individual officers.
- **Super Admin (Future):** Manages framework taxonomy, domain configurations, and system-wide settings.

## Product Purpose
SkillForge AI is an intelligent competency assessment and training recommendation engine built for India's Official Statistical System (MoSPI / DIID). It transitions government workforce training from untargeted catalog browsing into personalized, measured gap closure against an official four-domain competency framework. Success means an officer diagnoses their skill gaps in under 3 minutes and receives high-precision iGOT Karmayogi course recommendations, while trainers generate rigorous 10-question assessments from uploaded documents in under 30 seconds.

## Positioning
SkillForge AI is not a course hosting platform or competitor to iGOT Karmayogi; it is the precision competency measurement and targeted routing layer on top of iGOT Karmayogi and NSSTA catalogs, translating official statistical job roles into quantified competency ranges.

## Operating Context
- **Operational Environment:** Ministry of Statistics and Programme Implementation (MoSPI) — Data Informatics & Innovation Division (DIID) and National Statistical Systems Training Academy (NSSTA).
- **Official Competency Framework:** Four structured domains (Statistical, Technical, Digital Governance, Behavioural/Managerial).
- **Progressive Profiling Workflow:** 60-second minimum viable onboarding (Designation, Department, Job Role) generating immediate preliminary value, enriched progressively with experience and prior training history.
- **Non-Judgmental Evaluation:** Competency gaps are framed as objective growth pathways and confidence ranges, never as deficient percentages or punitive scores.

## Capabilities and Constraints
- **Competency Gap Analysis:** Measures officer capabilities against target ranges across all 4 domains (Statistical, Technical, Digital Governance, Behavioural); unmeasured domains are surfaced explicitly as "not yet assessed".
- **Targeted Recommendations:** 1–3 curated iGOT Karmayogi / NSSTA courses per flagged gap, with explicit contextual reasoning.
- **AI Quiz Generation:** Ingests PDF/PPT/DOC materials and leverages Gemini API to generate structured MCQs (questions, 4 options, correct answers, explanations) in under 25s with instant scoring and feedback.
- **Role-Based Dashboards:** Distinct Learner (individual gap snapshot, action paths, quiz history) and Admin (team competency coverage matrix, completion rates) views.
- **Constraints (MVP Scope):** Seeded course dataset rather than live iGOT API; no live SAML/HRIS sync in MVP (architected for future integration); no multilingual or virtual labs in hackathon scope.

## Brand Commitments
- **Name:** SkillForge AI
- **Tone & Voice:** Professional, non-judgmental, precise, objective, institutional yet modern.
- **Visual Direction:** "The Caliper" — statistical measurement instrument aesthetic (gauges, calipers, calibration ticks, confident measured ranges, Archivo/Public Sans typography with IBM Plex Mono tabular numerals, cool paper light / warm charcoal dark theme).

## Evidence on Hand
- Official MoSPI Problem Statement 26101 (Theme: Smart Education, Smart India Hackathon 2026).
- Comprehensive PRD specification documented in `SIH Planning Draft.md`.
- Competency taxonomy seeded across 4 domains (Statistical: 10 skills, Technical: 12 skills, Digital Governance: 5 skills, Behavioural: 6 skills).

## Product Principles
1. **Measured Ranges Over False Precision:** Present competency as calibrated confidence ranges and growth opportunities rather than arbitrary single-number percentages.
2. **Immediate Partial Value:** Deliver immediate gap insights in under 60 seconds from minimum viable profile data before prompting for progressive enrichment.
3. **One Clear Action per Screen:** Guide the learner directly to the single highest-impact gap closure action rather than overwhelming them with choices.
4. **Institutional Dignity:** Avoid superficial gamification (no streaks, badges, or cartoonish XP); treat statistical officers with professional respect.
5. **Explainable Recommendations:** Every course suggested must display the exact gap and rationale it resolves.

## Accessibility & Inclusion
- High contrast compliance in both light and dark themes.
- Strict keyboard navigation and focus states across all assessment and dashboard workflows.
- Respect for reduced motion preferences (`prefers-reduced-motion`).
- Compliant with India's Digital Personal Data Protection Act (DPDPA), 2023.
