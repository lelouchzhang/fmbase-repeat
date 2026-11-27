import apiClient from "@/libs/axios";
import {
  getLoginRedirectTarget,
  retrieveTokenFromCookie,
} from "@/libs/server-utils";
import { COOKIE_KEYS } from "@fmbase/constants";
import { OrganizationWithMeta } from "@fmbase/types";
import { redirect } from "next/navigation";
import { connection } from "next/server";

export async function retrieveMyOrganizationsFromApi(): Promise<
  OrganizationWithMeta[]
> {
  await connection();
  const token = await retrieveTokenFromCookie();
  try {
    const { data } = await apiClient.get<OrganizationWithMeta[]>(
      `/organizations`,
      {
        headers: {
          Cookie: `${COOKIE_KEYS.ACCESS_TOKEN}=${token}`,
        },
        withCredentials: true,
      },
    );
    return data;
  } catch {
    redirect(await getLoginRedirectTarget());
  }
}

export async function retrieveOrganizationsBySlugFromApi(slug: string) {
  await connection();
  const token = await retrieveTokenFromCookie();
  try {
    const { data } = await apiClient.get<OrganizationWithMeta>(
      `/organizations/${slug}`,
      {
        headers: {
          Cookie: `${COOKIE_KEYS.ACCESS_TOKEN}=${token}`,
        },
        withCredentials: true,
      },
    );
    return data;
  } catch {
    redirect(await getLoginRedirectTarget());
  }
}
