export const COOKIE_KEYS = {
  ACCESS_TOKEN: "fenm_access_token",
  REFRESH_TOKEN: "fenm_refresh_token",
} as const;

export const ORGANIZATION_USER_ROLES = {
  ADMIN: "admin",
  DEVELOPER: "developer",
} as const;

// FE

export const AUTH_INTENT = {
  LOGIN: "LOGIN",
  REGISTER: "REGISTER",
} as const;

export type AuthIntent = (typeof AUTH_INTENT)[keyof typeof AUTH_INTENT];
