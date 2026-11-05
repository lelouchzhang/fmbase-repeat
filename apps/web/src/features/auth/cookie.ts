import { COOKIE_KEYS } from "@fmbase/constants";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

type ParsedCookie = {
  name: string;
  value: string;
  options: {
    path: string;
    maxAge?: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: "lax" | "strict" | "none";
  };
};

/**
 * @mock const mockSetCookie =
  "accesstoken=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c; path=/; max-age=3600; httponly; secure; samesite=lax";
 */
export function parseSetCookieHeader(setCookie: string): ParsedCookie {
  const parts = setCookie.split(";").map((part) => part.trim());
  const [nameValue, ...attributes] = parts;

  const separatorIndex = nameValue.indexOf("=");
  const name = nameValue.slice(0, separatorIndex);
  const value = nameValue.slice(separatorIndex + 1);

  const options: ParsedCookie["options"] = {
    path: "/",
    httpOnly: true,
    secure: false,
    sameSite: "lax",
  };

  for (const attribute of attributes) {
    const separator = attribute.indexOf("=");

    const key =
      separator === -1
        ? attribute
        : attribute.slice(0, separator).toLowerCase();
    const value = separator === -1 ? "" : attribute.slice(separator + 1);

    switch (key) {
      case "path":
        options.path = value;
        break;
      case "max-age":
        options.maxAge = Number.parseInt(value, 10);
        break;
      case "httponly":
        options.httpOnly = true;
        break;
      case "secure":
        options.secure = true;
        break;
      case "samesite":
        options.sameSite =
          value.toLowerCase() as ParsedCookie["options"]["sameSite"];
        break;
    }
  }
  return { name, value, options };
}

function isAuthCookie(name: string) {
  return (
    name === COOKIE_KEYS.ACCESS_TOKEN || name === COOKIE_KEYS.REFRESH_TOKEN
  );
}

export async function applyAuthCookiesFromResponse(res: Response) {
  const cookieStore = await cookies();
  for (const header of res.headers.getSetCookie()) {
    const parsed = parseSetCookieHeader(header);
    if (!isAuthCookie(parsed.name)) continue;
    cookieStore.set(parsed.name, parsed.value, parsed.options);
  }
}

export function applyAuthCookiesToResponse(
  res: NextResponse,
  setCookieHeaders: string[],
) {
  for (const header of setCookieHeaders) {
    const parsed = parseSetCookieHeader(header);
    if (!isAuthCookie(parsed.name)) continue;
    res.cookies.set(parsed.name, parsed.value, parsed.options);
  }
}
