import { notFound } from "next/navigation";

// Dev-only routes for visually reviewing Caliper primitives in isolation.
// Not linked from product navigation; excluded entirely outside development.
export default function DevLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return <div className="min-h-full bg-background">{children}</div>;
}
