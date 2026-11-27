import { describe, expect, it } from "vitest";
import {
  currentPathFromHeaders,
  PATHNAME_HEADER,
  SEARCH_HEADER,
} from "./auth-redirect";

function headerStore(entries: Record<string, string>) {
  return { get: (key: string) => entries[key] ?? null };
}

describe("currentPathFromHeaders", () => {
  it("rebuilds the current path from middleware-injected headers", () => {
    expect(
      currentPathFromHeaders(
        headerStore({
          [PATHNAME_HEADER]: "/organizations/acme/projects",
          [SEARCH_HEADER]: "?tab=1",
        }),
      ),
    ).toBe("/organizations/acme/projects?tab=1");
  });

  it("returns an empty path when headers are missing", () => {
    expect(currentPathFromHeaders(headerStore({}))).toBe("");
  });

  it("rejects spoofed header values that are not in-app paths", () => {
    expect(
      currentPathFromHeaders(
        headerStore({ [PATHNAME_HEADER]: "//evil.com", [SEARCH_HEADER]: "" }),
      ),
    ).toBe("");
  });
});
