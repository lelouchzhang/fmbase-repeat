import {
  buildLoginPath,
  isAuthPath,
  isPublicPath,
  sanitizeNext,
} from "./auth-redirect";

export type ProxyInput = {
  pathname: string;
  /** 原始 query string，存在时包含前导 `?`。 */
  search: string;
  /** 已解码的 `next` 查询参数，缺省为 null。 */
  next: string | null;
  isAccessTokenValid: boolean;
  hasRefreshToken: boolean;
};

/**
 * 中间件的决策结果，由 proxy.ts 负责执行副作用（重定向 / 刷新 / 放行）。
 * - redirect：直接重定向到 `to`。
 * - refresh-and-redirect：先尝试刷新会话，再重定向到 `to`。
 * - refresh-and-continue：先尝试刷新会话，成功后放行当前请求。
 * - continue：直接放行。
 */
export type ProxyDecision =
  | { kind: "redirect"; to: string }
  | { kind: "refresh-and-redirect"; to: string }
  | { kind: "refresh-and-continue" }
  | { kind: "continue" };

/**
 * 中间件的纯决策层。不依赖 `next/server`，也不做 JWT I/O，
 * 因此每个分支都能在不 mock 运行时的前提下直接单元测试
 * （见 proxy-policy.spec.ts）。
 * ADR：已登录用户访问认证页时一律回跳 `next`，而不是写死 /dashboard，
 * 否则邀请链接（/invite?next=...）会在登录后丢失。
 */
export function resolveProxyDecision(input: ProxyInput): ProxyDecision {
  const { pathname, search, next, isAccessTokenValid, hasRefreshToken } = input;
  const target = sanitizeNext(next);

  if (isAuthPath(pathname)) {
    if (isAccessTokenValid) return { kind: "redirect", to: target };
    if (hasRefreshToken) return { kind: "refresh-and-redirect", to: target };
    return { kind: "continue" };
  }

  if (!isPublicPath(pathname) && !isAccessTokenValid) {
    if (hasRefreshToken) return { kind: "refresh-and-continue" };
    return { kind: "redirect", to: buildLoginPath(pathname + search) };
  }

  return { kind: "continue" };
}
