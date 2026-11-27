import { ORGANIZATION_ROLES } from "@fmbase/constants";
import { InviteMemberInput, UpdateRoleInput } from "@fmbase/types";
import { z } from "zod";

export const inviteSchema = z.object({
  email: z.email("Invalid email"),
}) satisfies z.ZodType<InviteMemberInput>;

export const updateSchema = z.object({
  role: z.enum([ORGANIZATION_ROLES.ADMIN, ORGANIZATION_ROLES.DEVELOPER]),
}) satisfies z.ZodType<UpdateRoleInput>;
