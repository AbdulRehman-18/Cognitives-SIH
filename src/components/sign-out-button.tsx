"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function SignOutButton({ label = "Sign out" }: { label?: string }) {
  return (
    <Button variant="ghost" size="sm" onClick={() => signOut({ redirectTo: "/sign-in" })}>
      {label}
    </Button>
  );
}
