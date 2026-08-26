"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signInAction, type AuthActionState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const initialState: AuthActionState = {};

export default function SignInPage() {
  const [state, formAction, isPending] = useActionState(signInAction, initialState);

  return (
    <Card className="w-full max-w-sm rounded-md">
      <CardHeader>
        <CardTitle className="text-xl">Sign in</CardTitle>
        <CardDescription>
          Measure your competencies against your official role profile.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="officer@mospi.gov.in"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>

          {state.error ? (
            <p role="alert" className="text-sm text-[color:var(--color-critical)]">
              {state.error}
            </p>
          ) : null}

          <Button type="submit" disabled={isPending} className="mt-1">
            {isPending ? "Signing in…" : "Sign in"}
          </Button>

          <div className="relative my-1 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          {/* PRD reserves this slot for the eventual enterprise SSO swap —
              visible but inactive so the layout doesn't change later. */}
          <Button type="button" variant="outline" disabled aria-disabled className="cursor-not-allowed">
            Sign in with SSO
            <span className="ml-1.5 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              Coming soon
            </span>
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/sign-up" className="font-medium text-foreground underline underline-offset-4">
            Create one
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
