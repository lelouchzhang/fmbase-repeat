import { describe, expect, it } from "vitest";
import { resolveProxyDecision, type ProxyInput } from "./proxy-policy.js";

const anonymous: ProxyInput = {
  pathname: "/",
  search: "",
  next: null,
  isAccessTokenValid: false,
  hasRefreshToken: false,
};

describe("auth routes", () => {
  it("respects next for an already authenticated visitor", () => {
    expect(
      resolveProxyDecision({
        ...anonymous,
        pathname: "/login",
        next: "/invite",
        isAccessTokenValid: true,
      }),
    ).toEqual({ kind: "redirect", to: "/invite" });
  });

  it("falls back to the dashboard when no next is present", () => {
    expect(
      resolveProxyDecision({
        ...anonymous,
        pathname: "/register",
        isAccessTokenValid: true,
      }),
    ).toEqual({ kind: "redirect", to: "/dashboard" });
  });

  it("respects next when the session can be refreshed", () => {
    expect(
      resolveProxyDecision({
        ...anonymous,
        pathname: "/login",
        next: "/invite",
        hasRefreshToken: true,
      }),
    ).toEqual({ kind: "refresh-and-redirect", to: "/invite" });
  });

  it("rejects a malicious next at the middleware boundary", () => {
    expect(
      resolveProxyDecision({
        ...anonymous,
        pathname: "/login",
        next: "//evil.com",
        isAccessTokenValid: true,
      }),
    ).toEqual({ kind: "redirect", to: "/dashboard" });
  });

  it("does not loop when next points back at an auth route", () => {
    expect(
      resolveProxyDecision({
        ...anonymous,
        pathname: "/login",
        next: "/login",
        isAccessTokenValid: true,
      }),
    ).toEqual({ kind: "redirect", to: "/dashboard" });
  });

  it("keeps the login form reachable when unauthenticated", () => {
    expect(resolveProxyDecision({ ...anonymous, pathname: "/login" })).toEqual({
      kind: "continue",
    });
  });
});

describe("protected routes", () => {
  it("carries the current path and query into next when the session is gone", () => {
    expect(
      resolveProxyDecision({
        ...anonymous,
        pathname: "/organizations/acme/projects",
        search: "?tab=1",
      }),
    ).toEqual({
      kind: "redirect",
      to: `/login?next=${encodeURIComponent(
        "/organizations/acme/projects?tab=1",
      )}`,
    });
  });

  it("protects paths outside the old PROTECTED_ROUTES list too", () => {
    expect(
      resolveProxyDecision({ ...anonymous, pathname: "/settings/profile" }),
    ).toEqual({
      kind: "redirect",
      to: `/login?next=${encodeURIComponent("/settings/profile")}`,
    });
  });

  it("tries a refresh before sending the visitor to login", () => {
    expect(
      resolveProxyDecision({
        ...anonymous,
        pathname: "/dashboard",
        hasRefreshToken: true,
      }),
    ).toEqual({ kind: "refresh-and-continue" });
  });

  it("lets a valid session through", () => {
    expect(
      resolveProxyDecision({
        ...anonymous,
        pathname: "/dashboard",
        isAccessTokenValid: true,
      }),
    ).toEqual({ kind: "continue" });
  });

  it("does not challenge public routes", () => {
    expect(resolveProxyDecision(anonymous)).toEqual({ kind: "continue" });
    expect(resolveProxyDecision({ ...anonymous, pathname: "/invite" })).toEqual(
      { kind: "continue" },
    );
  });

  it("does not challenge static assets", () => {
    expect(
      resolveProxyDecision({ ...anonymous, pathname: "/file.svg" }),
    ).toEqual({ kind: "continue" });
  });
});
