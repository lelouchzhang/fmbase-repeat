import { COOKIE_KEYS } from "@fmbase/constants";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function signout() {
  // 我要访问后端，地址是`/api/auth/logout` POST 不需要参数，后端会清除cookies
  await fetch(`${process.env.API_URL}/auth/logout`, {
    method: "POST",
  });
  // 除此之外，前端也要同步清除cookies
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_KEYS.ACCESS_TOKEN);
  cookieStore.delete(COOKIE_KEYS.REFRESH_TOKEN);
  // 最后重定向到/login
  redirect("/login");
}
