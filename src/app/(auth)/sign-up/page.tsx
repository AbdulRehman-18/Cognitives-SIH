"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUpAction, type AuthActionState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const initialState: AuthActionState = {};

export default function SignUpPage() {
  const [state, formAction, isPending] = useActionState(signUpAction, initialState);

  return (
    <Card className="w-full max-w-sm rounded-md">
      <CardHeader>
        <CardTitle className="text-xl">Create your account</CardTitle>
        <CardDescription>
          Under a minute to a preliminary gap snapshot for your role.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" name="name" type="text" autoComplete="name" required />
          </div>
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
              autoComplete="new-password"
              minLength={8}
              required
            />
            <span className="text-xs text-muted-foreground">At least 8 characters.</span>
          </div>

          {state.error ? (
            <p role="alert" className="text-sm text-[color:var(--color-critical)]">
              {state.error}
            </p>
          ) : null}

          <Button type="submit" disabled={isPending} className="mt-1">
            {isPending ? "Creating account…" : "Create account"}
          </Button>

          <div className="relative my-1 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button type="button" variant="outline" disabled aria-disabled className="cursor-not-allowed">
            Sign up with SSO
            <span className="ml-1.5 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              Coming soon
            </span>
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/sign-in" className="font-medium text-foreground underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
