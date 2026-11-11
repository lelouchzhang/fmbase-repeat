import { buildLoginPath, currentPathFromHeaders } from "@/libs/auth-redirect";
import { COOKIE_KEYS } from "@fmbase/constants";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

/**
 * 服务端版本的 /login?next=...：从中间件注入的请求头重建当前地址。
 * @returns Promose<string> 登录页的跳转目标
 */
export async function getLoginRedirectTarget(): Promise<string> {
  const requestHeaders = await headers();
  return buildLoginPath(currentPathFromHeaders(requestHeaders));
}

/**
 * 从 Cookie 读取 access token；缺失时立即跳转登录页（携带当前路径作为 next）。
 * 用于 Server Components / Server Actions 中调用受保护 API 之前的取令牌步骤。
 */
export async function retrieveTokenFromCookie(): Promise<string> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_KEYS.ACCESS_TOKEN)?.value;
  if (!token) redirect(await getLoginRedirectTarget());
  return token;
}
