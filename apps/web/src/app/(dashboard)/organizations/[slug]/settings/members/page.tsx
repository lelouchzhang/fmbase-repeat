import MembersClientPage from "@/features/members/members-client";
import { retrieveMembersFromApi } from "@/features/members/members-helpers.server";
import { retrieveOrganizationsBySlugFromApi } from "@/features/organization/helper.server";

export const instant = false;

export default async function MembersSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const [organization, members] = await Promise.all([
    retrieveOrganizationsBySlugFromApi(slug),
    retrieveMembersFromApi(slug),
  ]);
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-medium">Members</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage who has access to {organization.name}
        </p>
      </div>
      <MembersClientPage
        slug={slug}
        currentUserRole={organization.role}
        members={members}
      />
    </div>
  );
}
