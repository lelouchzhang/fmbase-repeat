import apiClient from "@/libs/axios";
import { retrieveTokenFromCookie } from "@/libs/server-utils";
import { COOKIE_KEYS } from "@fmbase/constants";
import { OrganizationWithMeta } from "@fmbase/types";
import { redirect } from "next/navigation";

export async function retrieveMyOrganizationsFromApi(): Promise<
  OrganizationWithMeta[]
> {
  const token = await retrieveTokenFromCookie();
  try {
    const { data } = await apiClient.get<OrganizationWithMeta[]>(
      "/organizations",
      {
        headers: {
          Cookie: `${COOKIE_KEYS.ACCESS_TOKEN}=${token}`,
        },
      },
    );
    return data;
  } catch {
    redirect("/login");
  }
}

export async function retrieveOrganizationsBySlugFromApi(slug: string) {
  const token = await retrieveTokenFromCookie();
  try {
    const { data } = await apiClient.get(`/organization/${slug}`, {
      headers: {
        Cookie: `${COOKIE_KEYS.ACCESS_TOKEN}=${token}`,
      },
    });
    return data;
  } catch {
    redirect("/organizations");
  }
}
