# Deterministic Engine Specifications

Normative reference for everything under `src/lib/engines/`. If code and this document disagree, one of them is a bug.

## The rule these engines exist to enforce

PRD §2.5: **the LLM generates language, never a number.** Every function here is pure — structured input in, number or classification out. No network calls, no `lib/ai/` imports, no `Date.now()` inside the math (pass timestamps in as arguments so tests can pin them).

This is enforced by an ESLint `no-restricted-imports` rule and a test. It is not a style preference: it's the reason a judge asking "how was that computed?" gets a formula instead of a shrug.

---

## 1. Competency Engine — `competency.ts`

### Inputs
```ts
type ScoringInput = {
  assessmentAnswers: { correct: boolean; difficulty: number; competencyId: string }[];
  priorTrainings:    { relevance: number; monthsSince: number }[];
  assessmentHistory: { score: number; ageInAssessments: number }[];
};
```

### Formulas
```
assessmentScore = Σ(correct_i × difficulty_i) / Σ(difficulty_i)        → 0..1

priorTrainingScore = min(1, Σ(relevance × recencyDecay) / 3)
  recencyDecay = 0.5 ^ (monthsSince / 24)                              // 24-month half-life

historyScore = Σ(score_i × 0.7^age_i) / Σ(0.7^age_i)                   → 0..1

current = 100 × (0.60·assessmentScore + 0.25·priorTrainingScore + 0.15·historyScore)
          ÷ (sum of the weights whose terms are actually present)
level   = ceil(current / 20)                                            // 1..5
```

**Weight renormalization is mandatory.** An officer with assessment evidence but no prior training must not be penalised for the missing term — divide by the weights present (here 0.60+0.15=0.75), never by 1.0.

### `relevance` — resolved, and deliberately not an LLM call
`relevance ∈ {0, 0.5, 1.0}`, computed by **set overlap** between the prior training's tagged competency IDs and the competency being scored:
- `1.0` — direct match (the training is tagged with this competency)
- `0.5` — prerequisite or dependent of this competency in the `CompetencyPrerequisite` DAG (one hop)
- `0` — no relationship

Tempting to ask an LLM to judge relevance. **Don't.** That would put a model-chosen number directly into a score and forfeit the product's entire defensibility claim.

### Null handling
Zero evidence across all three terms ⇒ return `null`, rendered as **"Not yet assessed."** Never `0`. A `0` asserts measured incompetence; `null` honestly reports absence of evidence, and the PRD requires unmeasured domains be shown explicitly.

### Confidence
```
confidence = min(1, evidenceCount / 5) × avgRecencyFactor    → LOW <0.4, MEDIUM <0.75, HIGH ≥0.75
```
Drives the displayed range: `HIGH` → ±3, `MEDIUM` → ±7, `LOW` → ±12. This is what makes the UI show *measured ranges rather than false precision* (PRD §5.5).

### Evidence rows
Every non-zero term writes a `CompetencyEvidence` row (`sourceType`, `sourceId`, `contribution`, `weight`). `EvidenceDrawer` renders these directly — it must never recompute or paraphrase. Contributions must sum to the displayed score; assert this in tests.

---

## 2. Skill Gap Engine — `gap.ts`

```
gapSize  = max(0, requiredLevel − currentLevel)
weighted = gapSize × roleWeight × departmentPriority

CRITICAL  weighted ≥ 3.0  OR (gapSize ≥ 2 AND roleWeight ≥ 0.9)
HIGH      weighted ≥ 2.0
MEDIUM    weighted ≥ 1.0
LOW       weighted >  0
```

Export the thresholds as one const so the rule can be shown literally:
```ts
export const SEVERITY_THRESHOLDS = { CRITICAL: 3.0, HIGH: 2.0, MEDIUM: 1.0 } as const;
```

`currentLevel === null` (not yet assessed) is **not** a gap — it's an *unknown*, surfaced as "Assess this to find out." Treating unmeasured as a maximum gap would fabricate a critical shortage from missing data.

Ordering: severity rank, then `weighted` desc, then `competencyId` asc. The final tiebreak keeps ordering stable across identical inputs — required for determinism tests.

**The LLM writes `reason` only after severity is fixed**, and is handed the computed numbers in its prompt. Prompt it for one specific sentence naming the competency and the concrete gap; explicitly forbid inventing numbers. If generation fails, fall back to a deterministic template string — a missing reason must never block the gap from displaying.

---

## 3. Recommendation Engine — `recommendation.ts`

```
score = 0.35·semanticSimilarity      // pgvector cosine: gap text ↔ course embedding
      + 0.25·gapSeverityWeight       // CRITICAL 1.0 / HIGH 0.75 / MEDIUM 0.5 / LOW 0.25
      + 0.15·roleRelevance           // course competencies ∩ role target vector
      + 0.10·prerequisiteReadiness   // 1.0 if all prereqs met, 0.5 partial, 0.2 unmet
      + 0.10·difficultyFit           // 1 − |courseLevel − (currentLevel+1)| / 4
      + 0.05·departmentPriority
```

`difficultyFit` peaks at one level above current — the next reachable step, not the hardest available course.

Persist **every term** into `reasonsJson`. `ReasonBreakdown` renders the actual per-factor contributions; the UI must never show a hand-written justification in place of computed values.

If no course clears a minimum score, return the best available flagged `isClosestMatch: true` and show the caveat. PRD §4.4: no gap is left without at least one recommendation — but an honest weak match beats a confident bad one.

---

## 4. Learning Path Engine — `learning-path.ts`

Kahn's algorithm over `CompetencyPrerequisite`, tie-broken by gap priority, then greedy bin-packing into weeks at `maxWeeklyHours` (default 5) → 6–8 weeks.

**Cycle detection is mandatory and must throw.** If Kahn's terminates with nodes remaining, the seeded prerequisite graph is malformed — fail loudly with the offending competency IDs. A silently truncated learning path is a wrong answer that looks like a right one.

Invariant to assert in tests: no item appears before any of its prerequisites.

---

## Test requirements

- Same input × 100 runs ⇒ byte-identical output (all four engines).
- Every severity threshold boundary asserted exactly at the boundary (`weighted = 3.0` is CRITICAL, `2.999` is HIGH).
- Weight renormalization: assessment-only evidence must not be diluted by absent terms.
- Null propagation: no evidence ⇒ `null` everywhere, never `0`.
- Evidence contributions sum to the displayed score.
- Cyclic prerequisite graph ⇒ throws.
- Path ordering respects all prerequisite edges.
- **Architectural:** no file in `lib/engines/` imports from `lib/ai/`.
