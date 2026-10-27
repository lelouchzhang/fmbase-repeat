CREATE TYPE "public"."organizationUserRole" AS ENUM('admin', 'developer');--> statement-breakpoint
CREATE TABLE "organizations_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "organizationUserRole" DEFAULT 'developer' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"removed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizationsId" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"database_schema" text NOT NULL,
	"project_url" text NOT NULL,
	"anonymous_api_key" text NOT NULL,
	"service_role_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "projects_database_schema_unique" UNIQUE("database_schema"),
	CONSTRAINT "projects_project_url_unique" UNIQUE("project_url")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"provider" text DEFAULT 'email' NOT NULL,
	"provider_user_id" text,
	"name" text,
	"avatar_url" text,
	"password_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organizations_members" ADD CONSTRAINT "organizations_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations_members" ADD CONSTRAINT "organizations_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_organizationsId_organizations_id_fk" FOREIGN KEY ("organizationsId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_provider_provider_user_id_unique" ON "users" USING btree ("provider","provider_user_id");