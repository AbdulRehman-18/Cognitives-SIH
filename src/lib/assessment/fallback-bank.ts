import type { GenerateDiagnosticParams } from "./generate-diagnostic";
import type { GeneratedAssessment } from "@/lib/validation/assessment";

const BANK: { stem: string; options: string[]; answer: number; explanation: string }[] = [
  { stem: "In stratified sampling, what determines the boundaries between strata?", options: ["Random assignment", "Homogeneity within strata and heterogeneity between strata", "Equal population in each stratum", "Geographic convenience only"], answer: 1, explanation: "Strata are formed to be internally homogeneous and externally heterogeneous to reduce variance." },
  { stem: "Which measure best captures the accuracy of a survey estimate?", options: ["Sample size alone", "Mean Squared Error (bias² + variance)", "Number of strata", "Response rate only"], answer: 1, explanation: "MSE combines bias and variance." },
  { stem: "What is the primary purpose of the National Sample Survey (NSS) in India?", options: ["Conducting elections", "Collecting socio-economic data for policy", "Managing tax records", "Regulating banks"], answer: 1, explanation: "NSS provides socio-economic indicators." },
  { stem: "Which index measures price changes for a fixed basket?", options: ["Quantum index", "Laspeyres price index", "Fisher ideal index", "Paasche quantum index"], answer: 1, explanation: "Laspeyres uses base-period quantities." },
  { stem: "What does non-response bias affect most directly?", options: ["Sampling frame", "Representativeness of estimates", "Questionnaire length", "Data entry speed"], answer: 1, explanation: "Non-response skews who is represented." },
  { stem: "Which method is used for seasonal adjustment of time series?", options: ["X-13ARIMA-SEATS", "Simple moving average only", "Linear interpolation", "Logistic regression"], answer: 0, explanation: "X-13ARIMA-SEATS is the standard seasonal adjustment." },
  { stem: "In data governance, what does FAIR stand for?", options: ["Findable, Accessible, Interoperable, Reusable", "Fast, Accurate, Integrated, Reliable", "Filtered, Audited, Indexed, Reported", "Formal, Approved, Inspected, Released"], answer: 0, explanation: "FAIR principles for data stewardship." },
  { stem: "Which chart best shows distribution shape?", options: ["Pie chart", "Histogram", "Line chart", "Donut chart"], answer: 1, explanation: "Histograms reveal distribution shape." },
  { stem: "What is the purpose of a confidence interval?", options: ["To give a point estimate", "To quantify uncertainty around an estimate", "To prove causality", "To replace hypothesis testing"], answer: 1, explanation: "CIs express uncertainty at a confidence level." },
  { stem: "Which sampling design gives every unit equal inclusion probability?", options: ["Simple random sampling", "Purposive sampling", "Snowball sampling", "Convenience sampling"], answer: 0, explanation: "SRS: equal probability by definition." },
  { stem: "What does GDPR-equivalent data minimisation require?", options: ["Collect everything possible", "Collect only data needed for stated purpose", "Anonymise after 10 years", "Encrypt all backups"], answer: 1, explanation: "Minimisation = purpose-limited collection." },
  { stem: "When should you use a weighted mean over simple mean?", options: ["When observations have differing importance/reliability", "When data is normally distributed", "When sample size is large", "Always"], answer: 0, explanation: "Weights reflect differing importance." },
];

export function generateDiagnosticFallback(params: GenerateDiagnosticParams): GeneratedAssessment {
  const questions = [];
  let idx = 0;
  for (const comp of params.competencies) {
    for (let i = 0; i < params.questionsPerCompetency; i++) {
      const item = BANK[idx % BANK.length];
      idx++;
      questions.push({
        competencyId: comp.id,
        stem: `[${comp.name}] ${item.stem}`,
        options: item.options,
        correctAnswer: item.options[item.answer],
        explanation: item.explanation,
        difficulty: Math.min(1, Math.max(0.15, 0.5 + (comp.requiredLevel - 3) * 0.12)),
      });
    }
  }
  return { questions };
}
