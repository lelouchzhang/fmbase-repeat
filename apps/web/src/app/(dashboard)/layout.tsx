import { retrieveTokenFromCookie } from "@/libs/server-utils";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { TopNav } from "@/components/top-nav";
import { retrieveMyOrganizationsFromApi } from "@/features/organization/helper.server";
import { AppSidebar } from "@/components/app-sidebar";

export const instant = false;

async function getCurrentUser() {
  const token = await retrieveTokenFromCookie();

  const payload = JSON.parse(
    Buffer.from(token.split(".")[1], "base64").toString(),
  );

  return {
    email: payload.email as string,
    name: null,
  };
}
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [organizations, user] = await Promise.all([
    retrieveMyOrganizationsFromApi(),
    getCurrentUser(),
  ]);
  return (
    <SidebarProvider>
      <AppSidebar organizations={organizations} user={user} />
      <SidebarInset>
        <TopNav />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
