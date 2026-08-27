# SkillForge AI — Test Roadmap + Guided Test Interface + Tutor Integration

## Architecture Overview

```
Learning Path (/path)
  └─ Test milestones injected between course weeks
       └─ Each test opens → Split-screen: Chatbot (left) + Questions (right)
            └─ Performance tracked → Fed to Tutor (/tutor) automatically
```

---

## Part 1: Database Schema Changes

**New enum + 3 new models** in `prisma/schema.prisma`:

```prisma
enum TestLevel {
  FOUNDATION      // Level 1 - basic recall
  INTERMEDIATE    // Level 2 - application + analysis
  ADVANCED        // Level 3 - synthesis + evaluation
}

model TestRoadmap {
  id, userId, createdAt, updatedAt
  levels: TestMilestone[]
}

model TestMilestone {
  id, testRoadmapId (FK)
  level: TestLevel
  assessmentId → Assessment (the actual test)
  order: Int (1, 2, 3)
  status: enum { LOCKED, AVAILABLE, IN_PROGRESS, COMPLETED }
  score: Decimal?
  completedAt: DateTime?
}

model QuizHint {
  id, quizAttemptId (FK)
  questionId (FK)
  hintLevel: Int (1=vague, 2=moderate, 3=specific)
  hintText: String (the AI-generated hint)
  requestedAt: DateTime
}
```

**Migration**: `prisma migrate dev --name add-test-roadmap`

---

## Part 2: Test Roadmap Engine

**New file**: `src/lib/engines/test-roadmap.ts` (pure engine, no DB/AI imports)

- Input: user's competency gaps + role requirements
- Logic: Maps gap severity to test level:
  - CRITICAL/HIGH gaps → FOUNDATION test (can you do the basics?)
  - MEDIUM gaps → INTERMEDIATE test (can you apply knowledge?)
  - All gaps covered → ADVANCED test (can you synthesize and evaluate?)
- Output: ordered list of `{ level, competencyIds, difficultyRange }`
- This stays pure per PRD §2.5

**New file**: `src/lib/recommendations/load-test-roadmap.ts` (orchestration)

- Reads user's SkillGaps + RoleCompetencies
- Calls the pure engine
- Generates/persists assessments per level using existing `src/lib/questions/generate-mcq.ts`
- Persists TestRoadmap + TestMilestone rows
- Returns roadmap data for the UI

---

## Part 3: Augment Learning Path Page

**Modify**: `src/components/caliper/path-timeline.tsx`

- Add a new `PathTimelineItem` variant: `type: "test"` with level badge (Foundation/Intermediate/Advanced)
- Test items render with a distinct icon (e.g., clipboard-check) and level-colored badge
- Test items link to `/test/[milestoneId]` instead of external course URLs

**Modify**: `src/app/(learner)/path/page.tsx`

- After loading the course learning path, also load the test roadmap
- Interleave test milestones into weeks:
  - FOUNDATION test → after Week 2 (early, to baseline)
  - INTERMEDIATE test → after Week 4 (mid-point check)
  - ADVANCED test → after final week (capstone)
- Render mixed timeline with both course and test items

---

## Part 4: Guided Test Interface (Core Feature)

**New file**: `src/app/(learner)/test/[milestoneId]/page.tsx` (server component)

- Loads TestMilestone + its Assessment + questions
- Verifies milestone status is AVAILABLE
- Renders the split-screen `GuidedTestRunner`

**New file**: `src/app/(learner)/test/[milestoneId]/guided-test-runner.tsx` (client component)

### Progressive Option Reveal Design

**Problem solved**: With 4 options visible upfront, 3 wrong guesses = answer obvious by elimination, making the chatbot pointless.

**Solution**: Options are revealed progressively — the chatbot gates access to all options.

```
Question loads → Only Options A + B visible
    │
    ├─ Learner picks A (wrong)
    │   └─ Chatbot: "Not quite. Think about how X relates to Y..."
    │   └─ Option C revealed + hint shown
    │
    ├─ Learner picks B (wrong)
    │   └─ Chatbot: "Consider the difference between A and B in this context..."
    │   └─ Option D revealed + hint shown
    │
    └─ All 4 options now visible + chatbot has guided thinking
        └─ Learner picks final answer → Confirm
```

### Split-screen layout:
```
┌─────────────────────────────────────────────────────┐
│  [Chatbot Panel - 40%]  │  [Question Panel - 60%]   │
│                         │                           │
│  ┌───────────────────┐  │  ┌─────────────────────┐  │
│  │ Chat messages     │  │  │ Q3 of 10            │  │
│  │ (hints stream in) │  │  │ Progress bar        │  │
│  │                   │  │  │                     │  │
│  │ "Not quite.       │  │  │ Question stem       │  │
│  │  Think about..."  │  │  │                     │  │
│  │                   │  │  │ ● Option A (sel)    │  │
│  │ [Ask Chatbot]     │  │  │ ○ Option B          │  │
│  │                   │  │  │ ○ Option C (new)    │  │
│  │                   │  │  │                     │  │
│  │                   │  │  │ 1 wrong · 2 options │  │
│  │                   │  │  │ left · chatbot is   │  │
│  │                   │  │  │ guiding you         │  │
│  │                   │  │  │                     │  │
│  │                   │  │  │ [Confirm] (after    │  │
│  │                   │  │  │  selection)         │  │
│  └───────────────────┘  │  └─────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### State machine per question:

```
State 1: TWO_OPTIONS (Options A + B visible)
  ├─ Select + Confirm → score, move on
  ├─ Select wrong → auto-trigger hint → State 2
  └─ "Ask Chatbot" → hint → State 2

State 2: THREE_OPTIONS (A + B + C visible)
  ├─ Select + Confirm → score, move on
  ├─ Select wrong → auto-trigger hint → State 3
  └─ "Ask Chatbot" → hint → State 3

State 3: ALL_OPTIONS (A + B + C + D visible)
  ├─ Select + Confirm → score, move on
  └─ "Ask Chatbot" → deeper hint, no more reveal
```

### Key behaviors:
- **No skip**: "Confirm" button disabled until an option is selected
- **Progressive reveal**: Wrong answer OR "Ask Chatbot" triggers next option + hint
- **Hint levels**: Level 1 (vague nudge), Level 2 (framework reference), Level 3 (reasoning walkthrough)
- **Anti-gaming**: Chatbot asks "Does that change how you see the options?" after each hint — learner must acknowledge before confirming
- **State tracked**: `optionsRevealed: 2 | 3 | 4`, `hintsUsed: number`, `wrongAttempts: number`
- **Performance signal**: Higher hintsUsed + wrongAttempts = weaker mastery (fed to tutor)

---

## Part 5: Chatbot Hint API

**New file**: `src/app/api/test/hint/route.ts`

Streaming endpoint, similar to `/api/tutor`:

- Input: `{ questionId, selectedAnswer, hintLevel (1-3), optionsRevealed, attemptContext }`
- Retrieves relevant chunks (same as tutor)
- Builds a hint-specific system prompt:
  - Level 1 (vague): "Give a conceptual nudge. Point to the domain, not the answer."
  - Level 2 (moderate): "Give a structured hint. Mention the relevant framework or formula name, but don't solve it."
  - Level 3 (specific): "Walk through the reasoning steps to arrive at the answer, but stop short of stating it directly."
- Ends with: "Does that change how you see the options?" (anti-gaming check)
- Grounded in uploaded material (reuses RAG pipeline)
- Streams response to chatbot panel

**New file**: `src/lib/tutor/test-hint.ts`

- `buildHintSystemPrompt(level, question, selectedAnswer, citations, optionsRevealed)`
- Ensures hints never reveal the answer directly
- Calibrated to the test level (FOUNDATION hints are simpler than ADVANCED)
- Anti-gaming: hint prompt includes instruction to end with a comprehension check

---

## Part 6: Performance Tracking

**Modify**: `src/app/api/assessments/[id]/submit/route.ts`

- After scoring, also persist:
  - TestMilestone score + status → COMPLETED
  - QuizHint count per attempt (hints used / total questions)
  - Store `hintsUsedRatio` in attempt metadata
  - Store per-question: `{ optionsRevealed, wrongAttempts, hintsUsed }`

**New file**: `src/lib/recommendations/load-test-performance.ts`

- Queries all completed TestMilestones for a user
- Computes: average score, improvement trend (Foundation→Intermediate→Advanced), hints usage trend
- Returns structured data for tutor consumption

---

## Part 7: Tutor Integration (Automatic Context)

**Modify**: `src/lib/tutor/tutor.ts`

- Add `buildTestPerformanceContext(performanceData)` function
- Appends to the learner context in the system prompt:
  ```
  RECENT TEST PERFORMANCE:
  - Foundation test: 72% (used 3/10 hints)
  - Intermediate test: 65% (used 6/10 hints) — declined from Foundation
  - Weakest area: Sampling methods (40% on related questions)
  - Recommendation: Focus on sampling methodology before retaking Intermediate
  ```

**Modify**: `src/app/api/tutor/route.ts`

- Before building the system prompt, call `loadTestPerformance(userId)`
- Inject the performance context into `describeLearnerLevel()` output
- The tutor now automatically references test results when advising

**Modify**: `src/app/(learner)/tutor/tutor-chat.tsx`

- Add a "Test Performance" card in the sidebar (right column)
- Shows: last 3 test scores as mini bar chart, hint usage trend, weakest competency
- This is read-only context the tutor can reference

---

## File Change Summary

| File | Action | Purpose |
|------|--------|---------|
| `prisma/schema.prisma` | Modify | Add TestLevel, TestRoadmap, TestMilestone, QuizHint |
| `src/lib/engines/test-roadmap.ts` | **New** | Pure engine: gap→test level mapping |
| `src/lib/recommendations/load-test-roadmap.ts` | **New** | Orchestration: build + persist roadmap |
| `src/lib/recommendations/load-test-performance.ts` | **New** | Load performance data for tutor |
| `src/components/caliper/path-timeline.tsx` | Modify | Support test milestone items |
| `src/app/(learner)/path/page.tsx` | Modify | Interleave test milestones |
| `src/app/(learner)/test/[milestoneId]/page.tsx` | **New** | Test page server component |
| `src/app/(learner)/test/[milestoneId]/guided-test-runner.tsx` | **New** | Split-screen test UI with progressive reveal |
| `src/app/api/test/hint/route.ts` | **New** | Streaming hint endpoint |
| `src/lib/tutor/test-hint.ts` | **New** | Hint system prompt builder + anti-gaming |
| `src/app/api/assessments/[id]/submit/route.ts` | Modify | Persist milestone + hint data |
| `src/lib/tutor/tutor.ts` | Modify | Add test performance context |
| `src/app/api/tutor/route.ts` | Modify | Inject performance into tutor |
| `src/app/(learner)/tutor/tutor-chat.tsx` | Modify | Add performance sidebar card |

---

## Implementation Order

1. Schema + migration (foundation)
2. Test roadmap engine (pure, testable)
3. Test roadmap orchestration + assessment generation
4. Path page augmentation (test milestones in timeline)
5. Guided test runner (split-screen UI with progressive reveal)
6. Hint API + hint prompt builder
7. Performance tracking in submit route
8. Tutor integration (auto context)
9. Run lint + typecheck + tests
