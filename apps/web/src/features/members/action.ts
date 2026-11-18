import { retrieveTokenFromCookie } from "@/libs/server-utils";
import { membersServerSchema } from "./server.schema";
import { z } from "zod";
import { COOKIE_KEYS, MEMBERS_INTENT } from "@fmbase/constants";
import apiClient from "@/libs/axios";
import { revalidatePath } from "next/cache";

export type MembersActionState = {
  error?: string;
  success?: string;
};

export async function membersAction(
  _prev: MembersActionState,
  formdata: FormData,
  { slug }: { slug: string },
) {
  const raw = Object.entries(formdata);
  const parsedData = membersServerSchema.safeParse(raw);

  if (!parsedData.success) {
    return {
      error: z.flattenError(parsedData.error).formErrors[0],
    };
  }

  const token = await retrieveTokenFromCookie();
  const { intent, ...data } = parsedData.data;

  try {
    switch (intent) {
      case MEMBERS_INTENT.INVITE: {
        await apiClient.post(
          `/organizations/${slug}/invite`,
          { email: (data as { email: string }).email },
          { headers: { Cookie: `${COOKIE_KEYS.ACCESS_TOKEN}=${token}` } },
        );
        revalidatePath(`/organizations/${slug}/settings/members`);
        return { success: "Invite sent!" };
      }

      case MEMBERS_INTENT.UPDATE_ROLE: {
        const { memberId, role } = data as { memberId: string; role: string };
        await apiClient.patch(
          `/organizations/${slug}/members/${memberId}/role`,
          { role },
          { headers: { Cookie: `${COOKIE_KEYS.ACCESS_TOKEN}=${token}` } },
        );
        revalidatePath(`/organizations/${slug}/settings/members`);
        return { success: "Role updated" };
      }

      case MEMBERS_INTENT.REMOVE: {
        const { memberId } = data as { memberId: string };
        await apiClient.delete(`/organizations/${slug}/members/${memberId}`, {
          headers: { Cookie: `${COOKIE_KEYS.ACCESS_TOKEN}=${token}` },
        });
        revalidatePath(`/organizations/${slug}/settings/members`);
        return { success: "Member removed" };
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    return { error: err.response.data.message };
  }
}
