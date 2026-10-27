export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type RoleInOrganization = "admin" | "developer";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMember {
  id: string;
  oId: string;
  uId: string;
  role: RoleInOrganization;
  createdAt: string;
}

export interface Project {
  id: string;
  oId: string;
  name: string;
  slug: string;
  databaseSchema: string;
  projectUrl: string;
  anonymousApiKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
