ALTER TABLE "projects" RENAME COLUMN "organizationsId" TO "organizationId";--> statement-breakpoint
ALTER TABLE "projects" DROP CONSTRAINT "projects_organizationsId_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_organizationId_organizations_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;