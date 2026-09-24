import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { defaultRouteForRole } from "@/lib/auth/rbac";
import { LandingPage } from "@/components/landing/landing-page";

export default async function Home() {
  const session = await auth();

  if (session?.user) {
    redirect(defaultRouteForRole(session.user.role));
  }

  return <LandingPage />;
}
