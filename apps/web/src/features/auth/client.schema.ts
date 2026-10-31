import { LoginInput, RegisterInput } from "@fmbase/types";
import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
}) satisfies z.ZodType<LoginInput>;

export const registerSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
  name: z.string().min(1, "Name is required"),
}) satisfies z.ZodType<RegisterInput>;
