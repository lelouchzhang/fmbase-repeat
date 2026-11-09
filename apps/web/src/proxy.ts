import { applyAuthCookiesToResponse } from "@/features/auth/cookie";
import { COOKIE_KEYS } from "@fmbase/constants";
import { NextRequest, NextResponse } from "next/server";
import * as jose from "jose";

const AUTH_ROUTES = ["/login", "/register"];
const PROTECTED_ROUTES = ["/dashboard", "/organizations"];

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

function matchesRoute(pathname: string, routes: string[]) {
  return routes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export async function proxy(request: NextRequest) {
  // 由NextJS扩展后的request拥有便利能力
  const { pathname } = request.nextUrl;
  // 读取被config.matcher拦截的请求中携带的cookies
  const accessToken = request.cookies.get(COOKIE_KEYS.ACCESS_TOKEN)?.value;
  const refreshToken = request.cookies.get(COOKIE_KEYS.REFRESH_TOKEN)?.value;

  const isAuthRoute = matchesRoute(pathname, AUTH_ROUTES);
  const isProtectedRoute = matchesRoute(pathname, PROTECTED_ROUTES);

  let isValid = false;
  if (accessToken && process.env.JWT_ACCESS_SECRET) {
    try {
      // 将字符串转换为字节数组
      const secret = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET);
      // 使用密钥验证签名和有效期
      await jose.jwtVerify(accessToken, secret);
      isValid = true;
    } catch {}
  }

  if (isAuthRoute && isValid) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (isAuthRoute && refreshToken) {
    const response = NextResponse.redirect(new URL("/dashboard", request.url));
    if (await refreshSession(refreshToken, response)) return response;
  }

  if (isProtectedRoute && !isValid) {
    if (refreshToken) {
      const response = NextResponse.next();
      if (await refreshSession(refreshToken, response)) {
        return response;
      }
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

// 匹配到 config.matcher 的路径才会被拦截
// 排除静态资源 '/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)',

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

/**
 * proxy.ts在做什么?
 * 1. 拦截符合config.matcher的请求，进行会话验证和刷新逻辑处理(不推荐在此拦截和验证)
 * 2. 从NextJS增强版的request: NextRequest中读取cookies,并判断请求路径类型
 * 3. 使用jose进行本地的jwt access token验证
 * 4. 如果access验证通过且为auth路由,返回一个NextResponse.redirect重定向对象
 * 5. 如果access验证未通过但refresh存在,创建一个重定向响应对象，然后尝试刷新会话，如果刷新成功，则返回该重定向对象
 * 6. 如果access验证未通过且访问的是受保护的路由,尝试更新refresh token,如果更新成功，则返回该重定向对象,失败返回/login
 * 7. 其余情况,返回一个NextResponse.redirect重定向对象到登录页
 * 8. 如果请求路径属于不需要登录就能访问的路由,返回一个NextResponse.next()对象,继续处理请求
 */
