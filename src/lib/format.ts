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
