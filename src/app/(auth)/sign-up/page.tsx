import { SsoButtons } from "@/components/sso-buttons";
import { enabledSsoProviders, ssoErrorMessage } from "@/lib/auth/sso";
import { SignUpForm } from "./sign-up-form";

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <SignUpForm sso={<SsoButtons providers={enabledSsoProviders()} verb="Sign up" />} notice={ssoErrorMessage(error)} />;
}
