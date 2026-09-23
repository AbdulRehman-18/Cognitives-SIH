// Fixed locale + time zone so server-rendered HTML (UTC on Vercel) and the
// browser produce identical strings — `toLocaleString()` with no arguments
// differs between the two and causes hydration mismatches.
const LOCALE = "en-IN";
const TIME_ZONE = "Asia/Kolkata";

const dateFmt = new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE, day: "numeric", month: "short", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE, day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

export function formatDate(value: Date | string | number): string {
  return dateFmt.format(new Date(value));
}

export function formatDateTime(value: Date | string | number): string {
  return dateTimeFmt.format(new Date(value));
}

/** Short human label for a stored document MIME type. */
export function documentTypeLabel(type: string): string {
  if (type.includes("pdf")) return "PDF";
  if (type.includes("wordprocessing")) return "DOCX";
  if (type.includes("presentation")) return "PPTX";
  if (type.startsWith("video/")) return "Video";
  if (type.startsWith("audio/")) return "Audio";
  if (type.startsWith("text/") || type.includes("subrip")) return "Transcript";
  return type;
}
