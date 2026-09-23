import { SsoButtons } from "@/components/sso-buttons";
import { enabledSsoProviders, ssoErrorMessage } from "@/lib/auth/sso";
import { SignInForm } from "./sign-in-form";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <SignInForm sso={<SsoButtons providers={enabledSsoProviders()} verb="Sign in" />} notice={ssoErrorMessage(error)} />;
}
