import "server-only";

import { createHash } from "node:crypto";
import { db } from "@/lib/db/client";
import { COURSE_CATALOG } from "../../../prisma/course-catalog";
import type { IgotCatalogCourse, IgotClient, IgotEnrolment, IgotUserProfile } from "./types";

// Mock iGOT Karmayogi — src/lib/igot/mock-client.ts
//
// Serves the REAL iGOT course rows transcribed from MoSPI/NSSTA documents
// (prisma/course-catalog.ts), with stable Sunbird-style ids. Enrolment state
// lives in IgotMockEnrolment, standing in for the remote platform, so the
// app's progress sync runs the same code path it would against live iGOT.
// Progress only moves when explicitly simulated — never randomly — so demos
// are repeatable.

export function mockExternalId(title: string): string {
  return `do_mock_${createHash("sha256").update(title).digest("hex").slice(0, 16)}`;
}

const CATALOG: IgotCatalogCourse[] = COURSE_CATALOG.filter((c) => c.source === "IGOT").map((c) => ({
  externalId: mockExternalId(c.title),
  title: c.title,
  description: c.description,
  provider: c.provider ?? null,
  competencyNames: c.competencies,
  level: c.level,
  durationHours: c.durationHours,
  url: c.externalUrl ?? "https://portal.igotkarmayogi.gov.in/",
  language: c.language ?? "en",
}));

// Deterministic "already completed on iGOT" history for profile import: the
// first two catalog courses tagged with competencies the officer's role
// targets, completed 14 and 7 months ago.
const IMPORTED_COMPLETION_AGES_MONTHS = [14, 7];

export class MockIgotClient implements IgotClient {
  readonly mode = "mock" as const;

  async listCourses(): Promise<IgotCatalogCourse[]> {
    return CATALOG;
  }

  async enrol(igotUserId: string, courseExternalId: string): Promise<{ enrolmentId: string }> {
    if (!CATALOG.some((c) => c.externalId === courseExternalId)) {
      throw new Error(`Unknown iGOT course ${courseExternalId}`);
    }
    const row = await db.igotMockEnrolment.upsert({
      where: { igotUserId_courseExternalId: { igotUserId, courseExternalId } },
      create: { igotUserId, courseExternalId },
      update: {},
    });
    return { enrolmentId: row.id };
  }

  async getEnrolments(igotUserId: string): Promise<IgotEnrolment[]> {
    const rows = await db.igotMockEnrolment.findMany({ where: { igotUserId } });
    return rows.map((r) => ({
      courseExternalId: r.courseExternalId,
      enrolmentId: r.id,
      progressPct: r.progressPct,
      completedAt: r.completedAt,
    }));
  }

  async getUserProfile(igotUserId: string): Promise<IgotUserProfile | null> {
    const user = await db.user.findUnique({
      where: { id: igotUserId },
      select: {
        department: { select: { name: true } },
        profile: { select: { designation: true } },
        jobRole: { select: { roleCompetencies: { select: { competency: { select: { name: true } } } } } },
      },
    });
    if (!user) return null;
    const roleCompetencies = new Set(user.jobRole?.roleCompetencies.map((rc) => rc.competency.name) ?? []);
    const now = Date.now();
    const completed = CATALOG.filter((c) => c.competencyNames.some((n) => roleCompetencies.has(n)))
      .slice(0, IMPORTED_COMPLETION_AGES_MONTHS.length)
      .map((c, i) => ({
        externalId: c.externalId,
        title: c.title,
        provider: c.provider,
        competencyNames: c.competencyNames,
        completedAt: new Date(now - IMPORTED_COMPLETION_AGES_MONTHS[i] * 30.4375 * 86_400_000),
      }));
    return {
      igotUserId,
      designation: user.profile?.designation ?? null,
      department: user.department?.name ?? null,
      completedCourses: completed,
    };
  }

  /** Mock-only: moves a simulated enrolment's progress (the remote side). */
  async simulateProgress(igotUserId: string, courseExternalId: string, progressPct: number): Promise<void> {
    const pct = Math.max(0, Math.min(100, Math.round(progressPct)));
    await db.igotMockEnrolment.update({
      where: { igotUserId_courseExternalId: { igotUserId, courseExternalId } },
      data: { progressPct: pct, completedAt: pct === 100 ? new Date() : null },
    });
  }
}
