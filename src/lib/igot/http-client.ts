import "server-only";

import type { IgotCatalogCourse, IgotClient, IgotEnrolment, IgotUserProfile } from "./types";
import { IgotError } from "./types";

// Live iGOT Karmayogi client — src/lib/igot/http-client.ts (IGOT_MODE=live)
//
// iGOT runs on the Sunbird platform; these calls follow Sunbird's public
// course/content APIs (composite search, course enrol, enrolment list).
// Access requires Karmayogi Bharat partner onboarding — base URL and key come
// from IGOT_API_BASE / IGOT_API_KEY (+ IGOT_USER_TOKEN for user-scoped
// calls). Field mapping is isolated in the `to*` functions below so it can be
// adjusted against the partner sandbox without touching callers.

interface SunbirdContent {
  identifier: string;
  name: string;
  description?: string;
  source?: string;
  competencies_v5?: { competencyAreaName?: string; competencyThemeName?: string }[];
  difficultyLevel?: string;
  duration?: string | number; // seconds
  language?: string[];
}

interface SunbirdEnrolment {
  courseId: string;
  batchId?: string;
  completionPercentage?: number;
  status?: number; // 2 = completed
  completedOn?: number | string;
}

const LEVELS: Record<string, number> = { beginner: 2, intermediate: 3, advanced: 4 };

function toCatalogCourse(c: SunbirdContent, portal: string): IgotCatalogCourse {
  const seconds = Number(c.duration ?? 0);
  return {
    externalId: c.identifier,
    title: c.name,
    description: c.description ?? "",
    provider: c.source ?? null,
    competencyNames: (c.competencies_v5 ?? []).map((x) => x.competencyThemeName ?? x.competencyAreaName ?? "").filter(Boolean),
    level: LEVELS[(c.difficultyLevel ?? "").toLowerCase()] ?? 3,
    durationHours: seconds > 0 ? Math.round((seconds / 3600) * 10) / 10 : 1,
    url: `${portal}app/toc/${c.identifier}/overview`,
    language: (c.language ?? []).some((l) => l.toLowerCase().startsWith("hi")) ? "hi" : "en",
  };
}

function toEnrolment(e: SunbirdEnrolment): IgotEnrolment {
  const completed = e.status === 2 || (e.completionPercentage ?? 0) >= 100;
  return {
    courseExternalId: e.courseId,
    enrolmentId: `${e.courseId}:${e.batchId ?? ""}`,
    progressPct: Math.round(e.completionPercentage ?? (completed ? 100 : 0)),
    completedAt: completed && e.completedOn ? new Date(e.completedOn) : completed ? new Date() : null,
  };
}

export class HttpIgotClient implements IgotClient {
  readonly mode = "live" as const;

  constructor(
    private readonly base = process.env.IGOT_API_BASE ?? "",
    private readonly apiKey = process.env.IGOT_API_KEY ?? "",
    private readonly userToken = process.env.IGOT_USER_TOKEN ?? "",
    private readonly portal = process.env.IGOT_PORTAL_URL ?? "https://portal.igotkarmayogi.gov.in/",
  ) {
    if (!base || !apiKey) throw new IgotError("IGOT_MODE=live requires IGOT_API_BASE and IGOT_API_KEY.");
  }

  private async call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.base.replace(/\/$/, "")}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        ...(this.userToken ? { "x-authenticated-user-token": this.userToken } : {}),
        ...init.headers,
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new IgotError(`iGOT ${path} failed (${res.status})`, res.status);
    return (await res.json()) as T;
  }

  async listCourses(): Promise<IgotCatalogCourse[]> {
    const body = await this.call<{ result?: { content?: SunbirdContent[] } }>("/api/content/v1/search", {
      method: "POST",
      body: JSON.stringify({ request: { filters: { primaryCategory: ["Course"], status: ["Live"] }, limit: 500 } }),
    });
    return (body.result?.content ?? []).map((c) => toCatalogCourse(c, this.portal));
  }

  async enrol(igotUserId: string, courseExternalId: string): Promise<{ enrolmentId: string }> {
    await this.call("/api/course/v1/enrol", {
      method: "POST",
      body: JSON.stringify({ request: { courseId: courseExternalId, userId: igotUserId } }),
    });
    return { enrolmentId: `${courseExternalId}:` };
  }

  async getEnrolments(igotUserId: string): Promise<IgotEnrolment[]> {
    const body = await this.call<{ result?: { courses?: SunbirdEnrolment[] } }>(
      `/api/course/v1/user/enrollment/list/${encodeURIComponent(igotUserId)}`,
    );
    return (body.result?.courses ?? []).map(toEnrolment);
  }

  async getUserProfile(igotUserId: string): Promise<IgotUserProfile | null> {
    const body = await this.call<{
      result?: { response?: { profileDetails?: { professionalDetails?: { designation?: string; name?: string }[] } } };
    }>(`/api/user/v1/read/${encodeURIComponent(igotUserId)}`);
    const pro = body.result?.response?.profileDetails?.professionalDetails?.[0];
    const completed = (await this.getEnrolments(igotUserId)).filter((e) => e.completedAt);
    const catalog = new Map((await this.listCourses()).map((c) => [c.externalId, c]));
    return {
      igotUserId,
      designation: pro?.designation ?? null,
      department: pro?.name ?? null,
      completedCourses: completed.map((e) => {
        const c = catalog.get(e.courseExternalId);
        return {
          externalId: e.courseExternalId,
          title: c?.title ?? e.courseExternalId,
          provider: c?.provider ?? null,
          competencyNames: c?.competencyNames ?? [],
          completedAt: e.completedAt!,
        };
      }),
    };
  }
}
