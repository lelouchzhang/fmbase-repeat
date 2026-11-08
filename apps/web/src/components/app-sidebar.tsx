"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import {
  Home,
  Table2,
  ShieldCheck,
  FolderOpen,
  Code2,
  Radio,
  Building2,
  ChevronsUpDown,
  Plus,
  Check,
  LogOut,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { signout } from "@/features/auth/signout";
import { OrganizationWithMeta } from "@fmbase/types";

const navItems = [
  { icon: Home, label: "Home", segment: "projects" },
  { icon: Table2, label: "Database", segment: "database" },
  { icon: ShieldCheck, label: "Auth", segment: "auth" },
  { icon: FolderOpen, label: "Storage", segment: "storage" },
  { icon: Code2, label: "API", segment: "api" },
  { icon: Radio, label: "Realtime", segment: "realtime" },
];

interface AppSidebarProps {
  organizations: OrganizationWithMeta[];
  user: { email: string; name: string | null };
}
export function AppSidebar({ organizations, user }: AppSidebarProps) {
  const pathname = usePathname();
  const params = useParams<{ slug: string }>();

  const currentOrganization =
    organizations.find((o) => o.slug === params?.slug) ?? organizations[0];

  return (
    <Sidebar collapsible="icon">
      {/* ── Header — org switcher ─────────────────────────────────── */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent"
                  >
                    <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                      <Building2 size={16} />
                    </div>
                    <div className="flex flex-col gap-0.5 leading-none">
                      <span className="font-semibold">
                        {currentOrganization.name}
                      </span>
                      <span className="text-xs text-muted-foreground capitalize">
                        {currentOrganization.role}
                      </span>
                    </div>
                    <ChevronsUpDown className="ml-auto" />
                  </SidebarMenuButton>
                }
              ></DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-popper-anchor-width]"
                align="start"
              >
                {organizations.map((o) => (
                  <DropdownMenuItem
                    key={o.id}
                    render={
                      <Link
                        key={o.id}
                        href={`/organizations/${o.slug}/projects`}
                        className="flex items-center justify-between"
                      >
                        <span>{currentOrganization.name}</span>
                        {params?.slug && <Check size={14} />}
                      </Link>
                    }
                  ></DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  render={<Link href="/organizations">All organizations</Link>}
                ></DropdownMenuItem>
                <DropdownMenuItem
                  render={
                    <Link
                      href="/organizations/new"
                      className="flex items-center gap-1.5"
                    >
                      <Plus size={14} />
                      New organization
                    </Link>
                  }
                ></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* ── Content — nav items ───────────────────────────────────── */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map(({ icon: Icon, label, segment }) => {
                const href = params?.slug
                  ? `/organizations/${params.slug}/${segment}`
                  : "/organizations";
                const isActive = pathname === href;

                return (
                  <SidebarMenuItem key={label}>
                    <SidebarMenuButton
                      isActive={isActive}
                      tooltip={label}
                      render={
                        <Link href={href}>
                          <Icon />
                          <span>{label}</span>
                        </Link>
                      }
                    ></SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* ── Footer — user menu ────────────────────────────────────── */}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent"
                  >
                    <Avatar className="size-8 rounded-lg">
                      <AvatarFallback className="rounded-lg">
                        {(user.name ?? user.email).charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col gap-0.5 leading-none">
                      <span className="font-semibold">Account</span>
                      <span className="text-xs text-muted-foreground truncate">
                        {user.name ?? "Account"}
                      </span>
                    </div>
                    <ChevronsUpDown className="ml-auto" />
                  </SidebarMenuButton>
                }
              ></DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-popper-anchor-width]"
                side="top"
                align="start"
              >
                <DropdownMenuItem
                  render={<Link href="/settings">Settings</Link>}
                ></DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={(event) => event.preventDefault()}
                  render={
                    <form action={signout} onSelect={(e) => e.preventDefault()}>
                      <button
                        type="submit"
                        className="flex w-full items-center gap-1.5 text-destructive text-sm"
                      >
                        <LogOut size={14} />
                        Sign out
                      </button>
                    </form>
                  }
                ></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
