import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Prisma 7 moves connection URLs for the CLI (migrate/studio/db) here.
// PrismaClient itself is instantiated with a driver adapter — see
// src/lib/db/client.ts — this config only serves the Prisma CLI.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
