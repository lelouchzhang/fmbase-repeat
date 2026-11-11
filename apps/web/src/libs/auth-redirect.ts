/**
 *  `src/libs/auth-redirect.ts` —— 纯函数工具层（路径分类 + `next` 的唯一仲裁者）
 * ADR：`next` 是登录后跳转的唯一事实来源。
 * 它只是「目的地」，绝不是鉴权输入：它决定用户去哪，而不是用户能不能去。
 * 所有消费方（中间件、Server Action、Server Components）都必须通过
 * `sanitizeNext` 解析它，保证各层之间的白名单不会漂移。
 *
 * ADR：路由分类采用「默认拒绝」（deny-by-default）。只有落地页、邀请流程
 * 和静态资源是公开的；其余所有路径默认受保护，会话缺失时必须携带 `next`
 * 跳转登录页。曾经的 `PROTECTED_ROUTES` 白名单已被移除——一个不断增长的
 * 白名单会让新页面悄悄脱离这套跳转契约。
 */

/** 未提供 `next` 时的默认回跳地址。 */
export const DEFAULT_NEXT = "/dashboard";
/** 登录页路径。 */
export const LOGIN_PATH = "/login";
/** 中间件向 Server Components 转发 pathname 的请求头。 */
export const PATHNAME_HEADER = "x-fmbase-pathname";
/** 中间件向 Server Components 转发 query string 的请求头。 */
export const SEARCH_HEADER = "x-fmbase-search";

const AUTH_ROUTES = ["/login", "/register"];
const PUBLIC_ROUTES = ["/", "/invite"];
// 永远不可能真实解析成功的基准源，用于拒绝一切绝对地址
const PROBE_ORIGIN = "http://fmbase.invalid";
// Next.js 的 config.matcher 不允许捕获组，因此静态资源改为在可测试的决策层（isPublicPath）里放行。
const STATIC_ASSET = /\.(?:svg|png|jpe?g|gif|webp|ico|txt|xml|json|woff2?)$/i;

/** 精确匹配，返回结果为：判断 pathname 是/否 是routes路由/子路由一员 */
function matchesRoute(pathname: string, routes: readonly string[]): boolean {
  return routes.some(
    (route) =>
      pathname === route || (route !== "/" && pathname.startsWith(`${route}/`)),
  );
}

export function isAuthPath(pathname: string): boolean {
  return matchesRoute(pathname, AUTH_ROUTES);
}

export function isPublicPath(pathname: string): boolean {
  return STATIC_ASSET.test(pathname) || matchesRoute(pathname, PUBLIC_ROUTES);
}

/** 截取 `?` 或 `#` 之前的部分，得到纯路径。 */
function pathOf(value: string): string {
  const separator = value.search(/[?#]/);
  return separator === -1 ? value : value.slice(0, separator);
}

/**
 * 拒绝非法的next参数
 * 指回登录/注册页的地址同样会被拒绝，否则已登录用户会在 /login 上无限弹跳。
 * @returns 合法"next"
 */
export function sanitizeNext(raw: unknown, fallback = DEFAULT_NEXT): string {
  if (typeof raw !== "string") return fallback;
  const value = raw.trim();
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  // /[\\\u0000-\u001f\u007f]/: 危险字符黑名单
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return fallback;

  try {
    // 与 .invalid比对，相当于在此处拒绝值为一切绝对地址的"next"
    if (new URL(value, PROBE_ORIGIN).origin !== PROBE_ORIGIN) return fallback;
  } catch {
    return fallback;
  }

  if (isAuthPath(pathOf(value))) return fallback;
  return value;
}

/**
 * 构建 `/login?next=<当前路径>`，用于会话过期或主动登出后需要重新登录的场景。
 * 当前路径本身也要过一遍 `sanitizeNext`，避免把恶意地址拼进登录链接。
 * @returns 一个包含"next"的登录链接
 */
export function buildLoginPath(currentPath: string): string {
  const safe = sanitizeNext(currentPath, "");
  return safe ? `${LOGIN_PATH}?next=${encodeURIComponent(safe)}` : LOGIN_PATH;
}

/**
 * 解析中间件传递的请求头，中间件在收到request时会将pathname和search写入请求头
 * 请求头属于不可信输入。
 * 返回空字符串表示头部缺失或非法，调用方应回退到 `DEFAULT_NEXT`。
 * @param store 一个保证存在get方法的类headers对象。
 * @returns 合法"next"或sanitizeNext的fallback
 */
export function currentPathFromHeaders(store: Pick<Headers, "get">): string {
  const pathname = store.get(PATHNAME_HEADER) ?? "";
  const search = store.get(SEARCH_HEADER) ?? "";
  return sanitizeNext(pathname + search, "");
}
