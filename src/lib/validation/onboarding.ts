import { z } from "zod";

export const EDUCATION_LEVELS = ["Graduate", "Postgraduate", "MPhil", "PhD", "Other"] as const;

export const priorTrainingInputSchema = z.object({
  title: z.string().trim().min(3, "Training title is too short.").max(200),
  provider: z.string().trim().max(120).optional().or(z.literal("").transform(() => undefined)),
  /** "YYYY-MM" from a month input. */
  completedMonth: z.string().regex(/^\d{4}-\d{2}$/, "Pick the month you completed it."),
  competencyIds: z.array(z.string().min(1)).min(1, "Tag at least one competency the training covered.").max(6),
});
export type PriorTrainingInput = z.infer<typeof priorTrainingInputSchema>;

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal("").transform(() => undefined));

export const profileDetailsSchema = z.object({
  education: z.enum(EDUCATION_LEVELS).optional().or(z.literal("").transform(() => undefined)),
  educationField: optionalText(120),
  yearsExperience: z.coerce.number().int().min(0).max(45).optional().or(z.literal("").transform(() => undefined)),
  currentAssignment: optionalText(200),
});

export const onboardingSchema = profileDetailsSchema.extend({
  designation: z.string().trim().min(1, "Designation is required."),
  departmentId: z.string().trim().min(1, "Select your division."),
  roleId: z.string().trim().min(1, "Select your job role."),
  priorTrainings: z.array(priorTrainingInputSchema).max(15).default([]),
  importIgot: z.boolean().default(false),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;

/** Parses the repeater's hidden JSON field; malformed input becomes a validation error, not a crash. */
export function parsePriorTrainingsField(raw: FormDataEntryValue | null): unknown {
  if (typeof raw !== "string" || raw.trim() === "") return [];
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
