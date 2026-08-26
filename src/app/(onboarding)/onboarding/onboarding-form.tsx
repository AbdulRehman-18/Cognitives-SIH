"use client";

import { useActionState } from "react";
import { ChevronDownIcon } from "lucide-react";
import { completeOnboardingAction, type OnboardingActionState } from "@/app/(onboarding)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const initialState: OnboardingActionState = {};

interface Option {
  id: string;
  name: string;
}

export function OnboardingForm({
  firstName,
  departments,
  roles,
}: {
  firstName?: string;
  departments: Option[];
  roles: Option[];
}) {
  const [state, formAction, isPending] = useActionState(completeOnboardingAction, initialState);

  return (
    <Card className="w-full max-w-md rounded-md">
      <CardHeader>
        <CardTitle className="text-xl">
          {firstName ? `Welcome, ${firstName}` : "Set up your profile"}
        </CardTitle>
        <CardDescription>
          Three details calibrate every measurement to your official role — gaps, targets, and
          course recommendations all derive from it. Takes under a minute.
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
