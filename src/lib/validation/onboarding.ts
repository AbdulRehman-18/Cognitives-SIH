import { z } from "zod";

export const onboardingSchema = z.object({
  designation: z.string().trim().min(1, "Designation is required."),
  departmentId: z.string().trim().min(1, "Select your division."),
  roleId: z.string().trim().min(1, "Select your job role."),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
