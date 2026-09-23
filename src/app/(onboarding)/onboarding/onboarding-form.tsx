"use client";

import { useActionState, useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import { completeOnboardingAction, type OnboardingActionState } from "@/app/(onboarding)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PriorTrainingsEditor, type CompetencyOption, type TrainingDraft } from "@/components/profile/prior-trainings-editor";
import { EDUCATION_LEVELS } from "@/lib/validation/onboarding";

const initialState: OnboardingActionState = {};

interface Option {
  id: string;
  name: string;
}

export function OnboardingForm({
  firstName,
  departments,
  roles,
  competencies,
  maxMonth,
}: {
  firstName?: string;
  departments: Option[];
  roles: Option[];
  competencies: CompetencyOption[];
  maxMonth: string;
}) {
  const [state, formAction, isPending] = useActionState(completeOnboardingAction, initialState);
  const [trainings, setTrainings] = useState<TrainingDraft[]>([]);

  return (
    <Card className="w-full max-w-xl rounded-md">
      <CardHeader>
        <CardTitle className="text-xl">
          {firstName ? `Welcome, ${firstName}` : "Set up your profile"}
        </CardTitle>
        <CardDescription>
          Three required details calibrate every measurement to your official role. The optional
          background and training history sharpen your starting competency profile.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="designation">Designation</Label>
            <Input
              id="designation"
              name="designation"
              required
              placeholder="e.g. Assistant Director"
              autoComplete="organization-title"
            />
            <p className="text-xs text-muted-foreground">Your current post or rank.</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="department">Division / Department</Label>
            <div className="relative">
              <select
                id="department"
                name="departmentId"
                required
                defaultValue=""
                className="h-8 w-full appearance-none rounded-lg border border-input bg-transparent px-2.5 pr-8 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
              >
                <option value="" disabled>
                  Select your division
                </option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="jobRole">Job role</Label>
            <div className="relative">
              <select
                id="jobRole"
                name="roleId"
                required
                defaultValue=""
                className="h-8 w-full appearance-none rounded-lg border border-input bg-transparent px-2.5 pr-8 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
              >
                <option value="" disabled>
                  Select your job role
                </option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">
              Determines the target competency profile you are measured against.
            </p>
          </div>

          <fieldset className="flex flex-col gap-4 border-t border-[color:var(--color-border-resting)] pt-4">
            <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Background (optional)</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="education">Highest qualification</Label>
                <select id="education" name="education" defaultValue="" className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none dark:bg-input/30">
                  <option value="">Prefer not to say</option>
                  {EDUCATION_LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="educationField">Field of study</Label>
                <Input id="educationField" name="educationField" placeholder="e.g. Statistics" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="yearsExperience">Years of service</Label>
                <Input id="yearsExperience" name="yearsExperience" type="number" min={0} max={45} placeholder="e.g. 6" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="currentAssignment">Current assignment</Label>
                <Input id="currentAssignment" name="currentAssignment" placeholder="e.g. PLFS field operations" />
              </div>
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-3 border-t border-[color:var(--color-border-resting)] pt-4">
            <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Previous trainings (optional)</legend>
            <p className="text-xs text-muted-foreground">Each one counts as evidence for the competencies you tag, weighted by how recent it is. It can inform your score but never replaces an assessment.</p>
            <PriorTrainingsEditor competencies={competencies} value={trainings} onChange={setTrainings} maxMonth={maxMonth} />
            <input type="hidden" name="priorTrainings" value={JSON.stringify(trainings.map((t) => ({ ...t, provider: t.provider || undefined })))} />
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="importIgot" defaultChecked className="mt-0.5" />
              <span>
                Import my completed courses from iGOT Karmayogi
                <span className="block text-xs text-muted-foreground">Adds your iGOT course history as training evidence.</span>
              </span>
            </label>
          </fieldset>

          {state.error ? (
            <p role="alert" className="text-sm text-[color:var(--color-critical)]">
              {state.error}
            </p>
          ) : null}

          <Button type="submit" disabled={isPending} className="mt-1">
            {isPending ? "Calibrating…" : "Complete setup"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
