"use client";

// Last-resort boundary for errors thrown by the root layout itself; it
// replaces the root layout, so it must render its own <html> and <body>.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 48 }}>
        <h1>Something went wrong</h1>
        <p>SkillForge AI hit an unexpected error.{error.digest ? ` Reference: ${error.digest}` : ""}</p>
        <button onClick={() => retry()}>Try again</button>
      </body>
    </html>
  );
}
