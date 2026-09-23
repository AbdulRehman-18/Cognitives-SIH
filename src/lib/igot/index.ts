import "server-only";

import { HttpIgotClient } from "./http-client";
import { MockIgotClient } from "./mock-client";
import type { IgotClient, IgotMode } from "./types";

export * from "./types";
export { MockIgotClient } from "./mock-client";

export function igotMode(): IgotMode {
  return process.env.IGOT_MODE === "live" ? "live" : "mock";
}

let client: IgotClient | null = null;

/** The configured iGOT client — mock by default, live when IGOT_MODE=live. */
export function getIgotClient(): IgotClient {
  client ??= igotMode() === "live" ? new HttpIgotClient() : new MockIgotClient();
  return client;
}
