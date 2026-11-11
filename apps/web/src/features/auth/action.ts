"use server";

import { AUTH_INTENT } from "@fmbase/constants";
import { authServerSchema } from "./server.schema";
import { z } from "zod";
import { redirect } from "next/navigation";
import { applyAuthCookiesFromResponse } from "./cookie";

export type AuthActionState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export async function authAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const raw = Object.fromEntries(formData);
  // 登录/注册成功后回跳目标（仅允许站内相对路径，防开放重定向）
  const rawNext = raw.next;
  const next =
    typeof rawNext === "string" &&
    rawNext.startsWith("/") &&
    !rawNext.startsWith("//")
      ? rawNext
      : "/dashboard";
  const parsedData = authServerSchema.safeParse(raw);

  if (!parsedData.success) {
    const flat = z.flattenError(parsedData.error);

    return {
      error: flat.formErrors[0],
      fieldErrors: flat.fieldErrors,
    };
  }

  const { intent, ...data } = parsedData.data;

  let res: Response;

  switch (intent) {
    case AUTH_INTENT.LOGIN: {
      res = await fetch(`${process.env.API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json();
        return {
          error: body.message ?? "Login failed",
        };
      }

      break;
    }
    case AUTH_INTENT.REGISTER: {
      res = await fetch(`${process.env.API_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json();
        return {
          error: body.message ?? "Registration failed",
        };
      }
      break;
    }
    default: {
      return { error: "Unsupported action." };
    }
  }

  await applyAuthCookiesFromResponse(res);
  redirect(next);
}
