import type { Provider } from "next-auth/providers";
import Google from "next-auth/providers/google";
import type { SsoProviderInfo } from "@/components/sso-buttons";

// Single sign-on providers — src/lib/auth/sso.ts
//
// Each provider is enabled purely by environment variables, so the same
// build runs with credentials-only, Google (demo), and/or a government
// OpenID Connect IdP (e.g. Jan Parichay / NIC SSO) as they become available.
//
// Every SSO user is created as a LEARNER. Roles are assigned by admins in
// the app — never taken from the identity provider's claims. Accounts are
// not auto-linked by email (no allowDangerousEmailAccountLinking): an email
// already registered with a password must keep signing in that way.

function govSsoEnv() {
  const { GOV_SSO_ISSUER, GOV_SSO_CLIENT_ID, GOV_SSO_CLIENT_SECRET, GOV_SSO_NAME } = process.env;
  return GOV_SSO_ISSUER && GOV_SSO_CLIENT_ID && GOV_SSO_CLIENT_SECRET
    ? { issuer: GOV_SSO_ISSUER, clientId: GOV_SSO_CLIENT_ID, clientSecret: GOV_SSO_CLIENT_SECRET, name: GOV_SSO_NAME ?? "Government SSO" }
    : null;
}

const googleEnabled = () => Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

export function ssoProviders(): Provider[] {
  const providers: Provider[] = [];
  const gov = govSsoEnv();
  if (gov) {
    providers.push({
      id: "gov-sso",
      name: gov.name,
      type: "oidc",
      issuer: gov.issuer,
      clientId: gov.clientId,
      clientSecret: gov.clientSecret,
      profile: (p: { sub: string; name?: string; email?: string }) => ({ id: p.sub, name: p.name ?? null, email: p.email ?? null, role: "LEARNER" as const }),
    });
  }
  if (googleEnabled()) {
    providers.push(
      Google({ profile: (p) => ({ id: p.sub, name: p.name, email: p.email, image: p.picture, role: "LEARNER" as const }) }),
    );
  }
  return providers;
}

/** Enabled SSO providers for the sign-in UI (no secrets). */
export function enabledSsoProviders(): SsoProviderInfo[] {
  const list: SsoProviderInfo[] = [];
  const gov = govSsoEnv();
  if (gov) list.push({ id: "gov-sso", name: gov.name });
  if (googleEnabled()) list.push({ id: "google", name: "Google" });
  return list;
}

/** Friendly text for Auth.js error codes surfaced on /sign-in?error=… */
export function ssoErrorMessage(code: string | undefined): string | null {
  switch (code) {
    case undefined:
      return null;
    case "OAuthAccountNotLinked":
      return "That email is already registered with a password. Sign in with your email and password instead.";
    case "AccessDenied":
      return "Sign-in was cancelled or denied by the identity provider.";
    default:
      return "Single sign-on failed. Try again, or sign in with your email and password.";
  }
}
