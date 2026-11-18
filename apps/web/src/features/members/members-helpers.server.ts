import apiClient from "@/libs/axios";
import { retrieveTokenFromCookie } from "@/libs/server-utils";
import { COOKIE_KEYS } from "@fmbase/constants";
import { OrganizationMemberWithUser } from "@fmbase/types";
import { redirect } from "next/navigation";

export async function retrieveMembersFromApi(
  slug: string,
): Promise<OrganizationMemberWithUser[]> {
  const token = await retrieveTokenFromCookie();

  try {
    const { data } = await apiClient.get<OrganizationMemberWithUser[]>(
      `/organizations/${slug}/members`,
      {
        headers: {
          Cookie: `${COOKIE_KEYS.ACCESS_TOKEN}=${token}`,
        },
      },
    );
    return data;
  } catch {
    redirect("/organizations");
  }
}
