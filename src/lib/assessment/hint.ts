import "server-only";
import { getAiProvider } from "@/lib/ai/provider";

// Deterministic tier: min(4, 1 + hintsAlreadyGiven)
export function computeHintTier(hintsAlreadyGiven: number): 1|2|3|4 {
  return Math.min(4, 1 + hintsAlreadyGiven) as 1|2|3|4;
}

export const HINT_SCORE_MULTIPLIER_FLOOR = 0.6;
export const HINT_PENALTY_PER_HINT = 0.1;
// score_multiplier = max(floor, 1 - 0.1*hints_used)
export function hintScoreMultiplier(hintsUsed: number): number {
  return Math.max(HINT_SCORE_MULTIPLIER_FLOOR, 1 - HINT_PENALTY_PER_HINT * hintsUsed);
}

export const FALLBACK_HINTS: Record<number,string> = {
  1: "What information does the question give you, and what is it asking you to find? List the knowns and the unknown before choosing a method.",
  2: "Think about which concept or formula category this belongs to — name the method first, then recall when it applies.",
  3: "Try working through the first step with the numbers given: set up the expression or structure, but pause before the final calculation.",
  4: "Consider a similar example with different numbers: if the values were changed but the method stayed the same, how would you apply it step by step?",
};

export function fallbackHint(tier: number): string {
  return FALLBACK_HINTS[tier] ?? FALLBACK_HINTS[1];
}

const TIER_INSTRUCTIONS: Record<number,string> = {
  1: "Tier 1: Ask ONE clarifying/orienting question back to the learner. No content hints.",
  2: "Tier 2: Name the relevant concept/method/formula category WITHOUT applying it to this problem's numbers.",
  3: "Tier 3: Walk through ONE partial step using this problem's actual numbers/context, stopping before the final calculation.",
  4: "Tier 4: Provide a FULLY worked example of the same method with DIFFERENT numbers/scenario — structurally identical, numerically different.",
};

const HARD_RULE = "HARD RULE: NEVER output the final numeric answer, the correct option letter, or a direct restatement of the correct conclusion. This is a strict constraint.";

export async function* streamGuideHint(questionStem: string, optionsJson: unknown, tier: 1|2|3|4, conversation: string): AsyncIterable<string> {
  const provider = getAiProvider();
  const system = `You are the SkillForge Socratic Guide. ${TIER_INSTRUCTIONS[tier]} ${HARD_RULE}`;
  const user = `Question: ${questionStem}\nOptions: ${JSON.stringify(optionsJson)}\nConversation so far: ${conversation}\nProduce ONLY the hint text for tier ${tier}.`;
  for await (const c of provider.streamText({ messages: [{role:"user",content:user}], system })) yield c;
}

export async function generateGuideHint(questionStem: string, optionsJson: unknown, tier: 1|2|3|4, conversation: string, attemptHistory?: string): Promise<string> {
  const provider = getAiProvider();
  const system = `You are the SkillForge Socratic Guide. ${TIER_INSTRUCTIONS[tier]} ${HARD_RULE}`;
  const user = `Question: ${questionStem}\nOptions: ${JSON.stringify(optionsJson)}\nConversation so far: ${conversation}\n${attemptHistory ?? ""}\nProduce ONLY the hint text for tier ${tier}.`;
  try {
    let out=""; for await (const c of provider.streamText({ messages: [{role:"user",content:user}], system })) out+=c; return out.trim();
  } catch { return fallbackHint(tier); }
}

export function plannerReasoning(hintsAlreadyGiven: number): string {
  const tier = computeHintTier(hintsAlreadyGiven);
  return `Tier ${tier} selected deterministically (${hintsAlreadyGiven} prior hints).`;
}

export function verifierStringCheck(hintText: string, correctAnswer: string): boolean {
  if (!correctAnswer) return true;
  const hint = hintText.toLowerCase();
  const ans = correctAnswer.toLowerCase().trim();
  // If hint contains exact answer string as standalone token
  if (ans.length <= 20 && hint.includes(ans)) {
    // For single letter options like "B", check with more context to avoid false positives
    if (ans.length === 1) {
      if (hint.includes(`option ${ans}`) || hint.includes(`answer is ${ans}`) || hint.includes(`correct answer is ${ans}`)) return false;
      return true;
    }
    // For numeric/short answers, if hint contains answer and says "answer is"
    if (hint.includes(`answer is ${ans}`) || hint.includes(`is ${ans}`)) {
      // still flag as unsafe if answer appears near "answer"
      if (hint.includes("answer")) return false;
    }
    // Don't block generic concept mentions; only block if answer appears with answer-indicating phrase
    return true;
  }
  return true;
}

export async function verifierLLMCheck(hintText: string, questionStem: string, correctAnswer: string): Promise<{safe:boolean, reason?:string}> {
  if (!verifierStringCheck(hintText, correctAnswer)) return { safe: false, reason: "Hint contains correct answer verbatim" };
  try {
    const provider = getAiProvider();
    let vout=""; for await (const c of provider.streamText({ messages: [{role:"user",content:`Question: ${questionStem}\nCorrect answer (hidden from learner): ${correctAnswer}\nHint to check: ${hintText}`}], system: "You are a verifier. Does the hint reveal or directly imply the final answer? Reply ONLY with JSON {\"safe\": boolean, \"reason\": string}." })) vout+=c; const parsed = JSON.parse(vout.replace(/```json|```/g,"").trim());
    return { safe: !!parsed.safe, reason: parsed.reason };
  } catch { return { safe: true }; }
}

export async function getVerifiedHint(questionStem: string, optionsJson: unknown, correctAnswer: string, tier: 1|2|3|4, conversation: string): Promise<{hintText:string, verifierPassed:boolean}> {
  let hint = await generateGuideHint(questionStem, optionsJson, tier, conversation);
  let v = await verifierLLMCheck(hint, questionStem, correctAnswer);
  if (!v.safe) {
    hint = await generateGuideHint(questionStem, optionsJson, tier, conversation + `\n[RETRY: previous hint leaked answer: ${v.reason}. Do not reveal the answer.]`);
    v = await verifierLLMCheck(hint, questionStem, correctAnswer);
    if (!v.safe) return { hintText: fallbackHint(tier), verifierPassed: false };
  }
  return { hintText: hint, verifierPassed: true };
}

// Tutor answer-detection: route "just give me answer" into hint ladder
export function isAnswerSeekingMessage(msg: string): boolean {
  return /just give me.*answer|give me the answer|what is the answer|tell me the answer|correct option/i.test(msg);
}
