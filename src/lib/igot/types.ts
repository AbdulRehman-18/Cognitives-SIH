// iGOT Karmayogi adapter contract — src/lib/igot/types.ts
//
// Everything the platform needs from iGOT Karmayogi, behind one interface so
// the mock (IGOT_MODE=mock, default) and the live Sunbird-based API client
// (IGOT_MODE=live) are interchangeable. Callers never branch on the mode
// except to show the mock-only "Simulate progress" control.

export type IgotMode = "mock" | "live";

export interface IgotCatalogCourse {
  /** iGOT content identifier (Sunbird `do_…` id). */
  externalId: string;
  title: string;
  description: string;
  provider: string | null;
  /** Competency NAMES from the MoSPI taxonomy — mapped to ids at sync time. */
  competencyNames: string[];
  /** 1–5 on the platform's level scale. */
  level: number;
  durationHours: number;
  url: string;
  language: "en" | "hi";
}

export interface IgotEnrolment {
  courseExternalId: string;
  enrolmentId: string;
  /** 0–100 */
  progressPct: number;
  completedAt: Date | null;
}

export interface IgotCompletedCourse {
  externalId: string;
  title: string;
  provider: string | null;
  competencyNames: string[];
  completedAt: Date;
}

export interface IgotUserProfile {
  igotUserId: string;
  designation: string | null;
  department: string | null;
  completedCourses: IgotCompletedCourse[];
}

export interface IgotClient {
  readonly mode: IgotMode;
  listCourses(): Promise<IgotCatalogCourse[]>;
  enrol(igotUserId: string, courseExternalId: string): Promise<{ enrolmentId: string }>;
  getEnrolments(igotUserId: string): Promise<IgotEnrolment[]>;
  getUserProfile(igotUserId: string): Promise<IgotUserProfile | null>;
}

export class IgotError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "IgotError";
  }
}
