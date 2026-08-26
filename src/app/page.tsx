import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { defaultRouteForRole } from "@/lib/auth/rbac";

export default async function Home() {
  const session = await auth();

  if (session?.user) {
    redirect(defaultRouteForRole(session.user.role));
  }

  redirect("/sign-in");
}
