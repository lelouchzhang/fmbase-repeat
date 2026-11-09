import { retrieveMyOrganizationsFromApi } from "@/features/organization/helper.server";
import { redirect } from "next/navigation";

export const instant = false;

export default async function DashboardPage() {
  const organizations = await retrieveMyOrganizationsFromApi();

  if (organizations.length === 1) {
    redirect(`/organizations/${organizations[0].slug}/projects`);
  }

  redirect("/organizations");
}
