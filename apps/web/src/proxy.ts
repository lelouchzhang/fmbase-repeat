import { applyAuthCookiesToResponse } from "@/features/auth/cookie";
import {
  buildLoginPath,
  PATHNAME_HEADER,
  SEARCH_HEADER,
} from "@/libs/auth-redirect";
import { resolveProxyDecision } from "@/libs/proxy-policy";
import { COOKIE_KEYS } from "@fmbase/constants";
import * as jose from "jose";
import { NextRequest, NextResponse } from "next/server";

/**
 * proxy.ts 在做什么？
 * 1. 拦截 config.matcher 命中的请求，用 jose 本地校验 access token。
 * 2. 把「路径 + next + 会话状态」交给纯决策层 resolveProxyDecision。
 * 3. 认证页上的已登录/可刷新会话一律回跳 next（或者fallback： /dashboard），不再写死 /dashboard。
 * 4. 其他路径默认受保护（只有 /、/invite 与静态资源公开），会话失效时跳
 *    /login?next=<当前路径+查询>，refresh 可用时先尝试刷新。
 * 5. 放行时把当前 pathname/search 写入请求头，供服务端 redirect('/login')
 *    重建 next；中间件无条件覆盖这两个头，客户端伪造无效。
 * 6. next 的合法性由 libs/auth-redirect.ts 统一裁定，中间件不做第二套判断。
 */

async function refreshSession(
  refreshToken: string,
  response: NextResponse,
): Promise<boolean> {
  const apiurl = process.env.API_URL;
  if (!apiurl) {
    throw new Error("API_URL is not defined in environment variables");
  }
  try {
    const refreshResponse = await fetch(`${apiurl}/auth/refresh`, {
      method: "POST",
      headers: {
        Cookie: `${COOKIE_KEYS.REFRESH_TOKEN}=${refreshToken}`,
      },
    });

    if (!refreshResponse.ok) return false;
    applyAuthCookiesToResponse(
      response,
      refreshResponse.headers.getSetCookie(),
    );
    return true;
  } catch (error) {
    console.error("Session refresh failed", error);
    return false;
  }
}

/**
 * Server Components 看不到请求的 URL，因此中间件会把当前 pathname/search 作为请求头转发过来。
 * @returns 根据中间件解析请求url的结果，将路径和参数写入请求头。
 */
function passThrough(
  request: NextRequest,
  pathname: string,
  search: string,
): NextResponse {
  // request.headers 在 Next.js 里是只读的,必须克隆一份才能set
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(PATHNAME_HEADER, pathname);
  requestHeaders.set(SEARCH_HEADER, search);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

/**
 * @example https://example.com/orders/detail?id=1&tab=2" => pathname="/orders/detail" search="?id=1&tab=2"
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const accessToken = request.cookies.get(COOKIE_KEYS.ACCESS_TOKEN)?.value;
  const refreshToken = request.cookies.get(COOKIE_KEYS.REFRESH_TOKEN)?.value;

  let isValid = false;
  if (accessToken && process.env.JWT_ACCESS_SECRET) {
    try {
      const secret = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET);
      await jose.jwtVerify(accessToken, secret);
      isValid = true;
    } catch {}
  }

  const decision = resolveProxyDecision({
    pathname,
    search,
    next: request.nextUrl.searchParams.get("next"),
    isAccessTokenValid: isValid,
    hasRefreshToken: Boolean(refreshToken),
  });

  if (decision.kind === "redirect") {
    return NextResponse.redirect(new URL(decision.to, request.url));
  }

  if (decision.kind === "refresh-and-redirect") {
    const response = NextResponse.redirect(new URL(decision.to, request.url));
    if (refreshToken && (await refreshSession(refreshToken, response))) {
      return response;
    }
    // 刷新失败不能假装已登录，留在认证页让用户重新登录。
    return passThrough(request, pathname, search);
  }

  if (decision.kind === "refresh-and-continue") {
    const response = passThrough(request, pathname, search);
    if (refreshToken && (await refreshSession(refreshToken, response))) {
      return response;
    }
    return NextResponse.redirect(
      new URL(buildLoginPath(pathname + search), request.url),
    );
  }

  return passThrough(request, pathname, search);
}

// 匹配到 config.matcher 的路径才会被拦截。
// ADR: Next.js 的 matcher 解析器不允许捕获组，静态资源改由
// auth-redirect.ts 的 isPublicPath() 放行；新增公开页面也加到那里。
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
