"use client";

import { ssoSignInAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

export interface SsoProviderInfo {
  id: string;
  name: string;
}

// Renders one button per enabled SSO provider, or the reserved inactive
// slot when none is configured (keeps the layout stable).
export function SsoButtons({ providers, verb }: { providers: SsoProviderInfo[]; verb: "Sign in" | "Sign up" }) {
  if (providers.length === 0) {
    return (
      <Button type="button" variant="outline" disabled aria-disabled className="cursor-not-allowed">
        {verb} with SSO
        <span className="ml-1.5 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">Not configured</span>
      </Button>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {providers.map((p) => (
        <form key={p.id} action={ssoSignInAction}>
          <input type="hidden" name="provider" value={p.id} />
          <Button type="submit" variant="outline" className="w-full">
            {verb} with {p.name}
          </Button>
        </form>
      ))}
    </div>
  );
}
