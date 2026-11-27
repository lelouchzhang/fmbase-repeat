import { describe, expect, it } from "vitest";
import {
  buildLoginPath,
  DEFAULT_NEXT,
  isAuthPath,
  isPublicPath,
  sanitizeNext,
} from "./auth-redirect.js";

describe("sanitizeNext", () => {
  it("keeps in-app absolute paths together with their query and hash", () => {
    expect(sanitizeNext("/organizations/acme/projects")).toBe(
      "/organizations/acme/projects",
    );
    expect(sanitizeNext("/organizations/acme/projects?tab=1#p")).toBe(
      "/organizations/acme/projects?tab=1#p",
    );
    expect(sanitizeNext("/invite?token=abc.def")).toBe("/invite?token=abc.def");
  });

  it("falls back when next is missing or not a string", () => {
    expect(sanitizeNext(null)).toBe(DEFAULT_NEXT);
    expect(sanitizeNext(undefined)).toBe(DEFAULT_NEXT);
    expect(sanitizeNext(123)).toBe(DEFAULT_NEXT);
    expect(sanitizeNext("")).toBe(DEFAULT_NEXT);
    expect(sanitizeNext("   ")).toBe(DEFAULT_NEXT);
  });

  it("rejects protocol-relative, absolute and non-path targets", () => {
    expect(sanitizeNext("//evil.com")).toBe(DEFAULT_NEXT);
    expect(sanitizeNext("///evil.com")).toBe(DEFAULT_NEXT);
    expect(sanitizeNext("https://evil.com")).toBe(DEFAULT_NEXT);
    expect(sanitizeNext("javascript:alert(1)")).toBe(DEFAULT_NEXT);
    expect(sanitizeNext("dashboard")).toBe(DEFAULT_NEXT);
  });

  it("rejects backslash variants and control characters", () => {
    expect(sanitizeNext("/\\evil.com")).toBe(DEFAULT_NEXT);
    expect(sanitizeNext("/dashboard\\evil.com")).toBe(DEFAULT_NEXT);
    expect(sanitizeNext("/dashboard\nSet-Cookie: x")).toBe(DEFAULT_NEXT);
    expect(sanitizeNext("/dashboard\r\nX")).toBe(DEFAULT_NEXT);
  });

  it("rejects auth routes themselves so next cannot cause a redirect loop", () => {
    expect(sanitizeNext("/login")).toBe(DEFAULT_NEXT);
    expect(sanitizeNext("/login?next=/invite")).toBe(DEFAULT_NEXT);
    expect(sanitizeNext("/register")).toBe(DEFAULT_NEXT);
    expect(sanitizeNext("/register/verify")).toBe(DEFAULT_NEXT);
  });

  it("does not misread query contents as the target", () => {
    expect(sanitizeNext("/dashboard?q=//evil.com")).toBe(
      "/dashboard?q=//evil.com",
    );
  });
});

describe("buildLoginPath", () => {
  it("carries the current path and query into an encoded next param", () => {
    const current = "/organizations/acme/projects?tab=1";
    expect(buildLoginPath(current)).toBe(
      `/login?next=${encodeURIComponent(current)}`,
    );
  });

  it("omits next when the current path is unusable or an auth route", () => {
    expect(buildLoginPath("")).toBe("/login");
    expect(buildLoginPath("/login")).toBe("/login");
    expect(buildLoginPath("/register?next=/invite")).toBe("/login");
  });
});

describe("route classification", () => {
  it("treats only the landing page and invite flow as public", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/invite")).toBe(true);
    expect(isPublicPath("/invite/abc")).toBe(true);
    expect(isPublicPath("/dashboard")).toBe(false);
    expect(isPublicPath("/organizations")).toBe(false);
  });

  it("recognises auth routes without matching lookalike prefixes", () => {
    expect(isAuthPath("/login")).toBe(true);
    expect(isAuthPath("/login/reset")).toBe(true);
    expect(isAuthPath("/register")).toBe(true);
    expect(isAuthPath("/login-ish")).toBe(false);
    expect(isPublicPath("/login")).toBe(false);
  });

  it("treats static assets as public so they are never challenged", () => {
    expect(isPublicPath("/file.svg")).toBe(true);
    expect(isPublicPath("/logo.PNG")).toBe(true);
    expect(isPublicPath("/robots.txt")).toBe(true);
    expect(isPublicPath("/organizations")).toBe(false);
  });
});
