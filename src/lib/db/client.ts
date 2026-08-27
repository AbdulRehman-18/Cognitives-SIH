import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 requires an explicit driver adapter — there is no implicit
// connection from `url` in schema.prisma any more (see prisma.config.ts,
// which only feeds the CLI). This is the single PrismaClient instance for
// the app; always import `db` from here, never `new PrismaClient()` elsewhere.

function normalizeDatabaseUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  // pg v9 / pg-connection-string v3 will make sslmode=require|prefer|verify-ca
  // behave as verify-full with weaker guarantees. Explicitly use verify-full
  // to keep current secure behavior and silence the SECURITY WARNING.
  if (url.includes("sslmode=require") || url.includes("sslmode=prefer") || url.includes("sslmode=verify-ca")) {
    return url.replace(/sslmode=(require|prefer|verify-ca)/g, "sslmode=verify-full");
  }
  return url;
}

const adapter = new PrismaPg({ connectionString: normalizeDatabaseUrl(process.env.DATABASE_URL) });

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
