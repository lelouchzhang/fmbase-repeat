import { MEMBERS_INTENT } from "@fmbase/constants";
import { z } from "zod";
import { inviteSchema, updateSchema } from "./client.schema";

export const membersServerSchema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal(MEMBERS_INTENT.INVITE),
    ...inviteSchema.shape,
  }),
  z.object({
    intent: z.literal(MEMBERS_INTENT.UPDATE_ROLE),
    memberId: z.string(),
    ...updateSchema.shape,
  }),
  z.object({
    intent: z.literal(MEMBERS_INTENT.REMOVE),
    memberId: z.string(),
  }),
]);
