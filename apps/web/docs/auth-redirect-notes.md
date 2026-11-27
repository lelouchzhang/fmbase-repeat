# 认证与重定向机制学习笔记

> 涉及文件：
> - `src/libs/auth-redirect.ts` —— 纯函数工具层（路径分类 + `next` 安全裁定）
> - `src/libs/proxy-policy.ts` —— 中间件的纯决策层
> - `src/libs/server-utils.ts` —— Server Components / Server Actions 的服务端助手
> - 相关：`src/proxy.ts`（中间件执行层）、`src/features/auth/action.ts`（登录/注册）

## 一、整体流程一图流

```
浏览器请求
   │
   ▼
proxy.ts（中间件，Edge 运行时）
   │  1. jose 本地校验 access token（不请求后端）
   │  2. 收集 pathname / search / next / 会话状态
   ▼
resolveProxyDecision()  ← 纯函数，无副作用，可单测
   │  返回四种决策之一
   ▼
执行决策：redirect / refresh-and-redirect / refresh-and-continue / continue
   │  放行时把 pathname+search 写入请求头 x-fmbase-pathname / x-fmbase-search
   ▼
Server Components / Server Actions
   │  取 token：retrieveTokenFromCookie()（无 token 则跳登录页）
   │  跳登录页：getLoginRedirectTarget()（从请求头重建 /login?next=...）
   │  登录/注册成功：authAction() 里 redirect(sanitizeNext(raw.next))
   ▼
登录页 → 登录成功 → 回到 next（缺省 /dashboard）
```

## 二、逐函数笔记

### auth-redirect.ts —— 「next」的唯一仲裁者

| 导出 | 作用 | 调用方 |
| --- | --- | --- |
| `DEFAULT_NEXT` / `LOGIN_PATH` | 默认回跳 `/dashboard`、登录页 `/login` | 各处 |
| `PATHNAME_HEADER` / `SEARCH_HEADER` | 中间件转发路径用的请求头名 | `proxy.ts`、`server-utils.ts` |
| `isAuthPath(pathname)` | 是否认证页（`/login`、`/register`） | `proxy-policy.ts`、`sanitizeNext` |
| `isPublicPath(pathname)` | 是否公开（静态资源、`/`、`/invite`） | `proxy-policy.ts` |
| `sanitizeNext(raw, fallback?)` | 裁定 `next` 是否安全，不安全则回退 | 中间件、Server Action、`buildLoginPath`、`currentPathFromHeaders` |
| `buildLoginPath(currentPath)` | 拼 `/login?next=<当前路径>` | `proxy.ts`、`server-utils.ts` |
| `currentPathFromHeaders(headers)` | 从请求头还原当前路径并校验 | `server-utils.ts` |

**`sanitizeNext` 的防开放重定向清单**（值得逐条学习）：

1. 非字符串 → 回退。
2. 必须以 `/` 开头且不是 `//`（阻断 `//evil.com` 协议相对 URL）。
3. 拒绝反斜杠 `\` 和控制字符（阻断响应头拆分）。
4. 用 `new URL(value, PROBE_ORIGIN)` 探测：规范化后 origin 一旦变化（如 `/\evil.com` 被规范成 `//evil.com`）→ 回退。
5. 目标指回认证页（`/login`、`/register`）→ 回退，防止已登录用户在登录页无限弹跳。

**设计要点**：所有层都通过 `sanitizeNext` 解析 `next`，白名单只有一份，不会漂移。

### proxy-policy.ts —— 纯决策层

`resolveProxyDecision(input)` 输入 `{ pathname, search, next, isAccessTokenValid, hasRefreshToken }`，输出四种决策：

| 场景 | 决策 |
| --- | --- |
| 认证页 + access token 有效 | `redirect → next`（保住邀请链接） |
| 认证页 + access 失效但有 refresh token | `refresh-and-redirect → next` |
| 认证页 + 完全无会话 | `continue`（让用户正常看登录页） |
| 受保护页 + access 失效但有 refresh token | `refresh-and-continue`（静默刷新后放行） |
| 受保护页 + 无会话 | `redirect → /login?next=<当前路径+查询>` |
| 公开路径 / 会话有效 | `continue` |

**设计要点**：
- 纯函数、不碰 `next/server`、不做 JWT I/O → 每个分支都能直接单元测试（`proxy-policy.spec.ts`）。
- 「默认拒绝」：只有 `/`、`/invite` 和静态资源公开，其余一律受保护。曾经用 `PROTECTED_ROUTES` 白名单，但白名单增长会让新页面悄悄失去保护，故改为黑名单式的公开清单。
- 静态资源在决策层放行而非 `config.matcher`，因为 Next.js 的 matcher 不支持捕获组。

### server-utils.ts —— 服务端取令牌与跳转

| 函数 | 行为 |
| --- | --- |
| `getLoginRedirectTarget()` | 读请求头 → `currentPathFromHeaders` 还原并校验 → `buildLoginPath` 拼出 `/login?next=...`。头部缺失/非法时回退裸 `/login` |
| `retrieveTokenFromCookie()` | 读 Cookie 中的 access token；没有则立即 `redirect` 到登录页。用于调受保护 API 之前 |

**调用方**：`app/(dashboard)/layout.tsx`、`features/organization/helper.server.ts`（API 失败兜底）、`features/auth/signout.ts`（登出后带 next 跳登录页）。

**为什么需要请求头转发**：Server Components 拿不到请求 URL，中间件在放行时无条件覆盖 `x-fmbase-pathname` / `x-fmbase-search` 两个头（客户端伪造无效），服务端再经 `sanitizeNext` 二次校验——因为请求头在模块边界上属于不可信输入。

## 三、核心设计思路（可迁移的经验）

1. **决策与执行分离**：策略写成纯函数（`resolveProxyDecision`），副作用（重定向、刷新、写 Cookie）留在薄的执行层（`proxy.ts`）。测试成本大幅降低，策略改动一眼看清。
2. **单一事实来源**：`next` 的合法性只有 `sanitizeNext` 一处裁定，中间件、Server Action、Server Components 共享，避免各层白名单漂移。
3. **deny-by-default**：受保护是常态，公开是例外；新增页面默认安全。
4. **纵深防御**：中间件校验一次，服务端从请求头还原时再校验一次（请求头不可信）。
5. **邀请链接不丢**：已登录用户访问认证页时回跳 `next` 而非写死 `/dashboard`。

## 四、测试地图

- `auth-redirect.spec.ts` —— `sanitizeNext` 攻击面、`buildLoginPath`、路由分类。
- `auth-redirect.headers.spec.ts` —— `currentPathFromHeaders` 对缺失/伪造头部的处理。
- `proxy-policy.spec.ts` —— 「auth routes」「protected routes」两组决策矩阵。
