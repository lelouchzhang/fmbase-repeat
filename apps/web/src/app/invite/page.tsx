"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "cn";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

const INVITE_TOKEN_KEY = "fmbase_invite_token";
const API_URL = process.env.NEXT_PUBLIC_API_URL;

type InviteInfo = {
  email: string;
  organizationId: string;
  organizationName: string;
};

function decodeInviteToken(token: string): InviteInfo | null {
  try {
    const payload = token.split(".")[1];
    const json = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
    ) as Partial<InviteInfo>;
    if (!json.email || !json.organizationName) return null;
    return json as InviteInfo;
  } catch {
    return null;
  }
}

export default function InvitePage() {
  return (
    <Suspense fallback={null}>
      <InviteCard />
    </Suspense>
  );
}

function InviteCard() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalidToken, setInvalidToken] = useState(false);

  // token 暂存 sessionStorage 并从 URL 清除，避免进入浏览器历史记录
  useEffect(() => {
    const fromUrl = searchParams.get("token");
    if (fromUrl) {
      sessionStorage.setItem(INVITE_TOKEN_KEY, fromUrl);
      router.replace("/invite");
      return;
    }
    const token = sessionStorage.getItem(INVITE_TOKEN_KEY);
    const info = token ? decodeInviteToken(token) : null;

    let cancelled = false;
    // 本地校验是纯计算，推迟到微任务更新状态，避免 effect 内同步 setState 造成级联渲染
    queueMicrotask(() => {
      if (cancelled) return;
      if (!info) {
        if (token) sessionStorage.removeItem(INVITE_TOKEN_KEY);
        setInvalidToken(true);
        setCheckingAuth(false);
        return;
      }
      setInviteInfo(info);
    });

    if (info) {
      fetch(`${API_URL}/auth/me`, { credentials: "include" })
        .then(async (res) => {
          if (cancelled) return;
          if (res.ok) {
            const user = (await res.json()) as { email?: string };
            setCurrentEmail(user.email ?? null);
          }
        })
        .catch(() => {
          if (!cancelled) setCurrentEmail(null);
        })
        .finally(() => {
          if (!cancelled) setCheckingAuth(false);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [searchParams, router]);

  const handleAccept = useCallback(async () => {
    const token = sessionStorage.getItem(INVITE_TOKEN_KEY);
    if (!token) {
      setInvalidToken(true);
      return;
    }
    setAccepting(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/orgs/invites/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? "Failed to accept invite. Please retry.");
        setAccepting(false);
        return;
      }
      sessionStorage.removeItem(INVITE_TOKEN_KEY);
      router.push("/dashboard");
    } catch {
      setError("Network error. Please retry.");
      setAccepting(false);
    }
  }, [router]);

  const emailMatches = currentEmail === inviteInfo?.email;

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4 py-12">
      <Card className="w-full max-w-md shadow-sm">
        <CardHeader>
          <CardTitle>You&apos;re invited</CardTitle>
          <CardDescription>
            {invalidToken
              ? "This invite link is invalid or has expired."
              : inviteInfo
                ? `Join ${inviteInfo.organizationName} on FMBase`
                : "Loading invite..."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {invalidToken && (
            <>
              <p className="text-sm text-muted-foreground">
                Please ask the organization admin to send you a new invitation.
              </p>
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "w-full",
                )}
              >
                Back to sign in
              </Link>
            </>
          )}

          {!invalidToken && inviteInfo && checkingAuth && (
            <p className="text-sm text-muted-foreground">
              Checking your session...
            </p>
          )}

          {!invalidToken && inviteInfo && !checkingAuth && (
            <>
              <div className="rounded-lg border bg-background px-4 py-3 text-sm space-y-1">
                <p>
                  <span className="text-muted-foreground">Invited email:</span>{" "}
                  <span className="font-medium">{inviteInfo.email}</span>
                </p>
                {currentEmail && (
                  <p>
                    <span className="text-muted-foreground">Signed in as:</span>{" "}
                    <span className="font-medium">{currentEmail}</span>
                  </p>
                )}
              </div>

              {!currentEmail && (
                <>
                  <p className="text-sm text-muted-foreground">
                    Sign in or create an account with the invited email to
                    accept this invitation.
                  </p>
                  <Link
                    href="/login?next=/invite"
                    className={cn(buttonVariants({ size: "lg" }), "w-full")}
                  >
                    Sign in to accept
                  </Link>
                  <Link
                    href="/register?next=/invite"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "lg" }),
                      "w-full",
                    )}
                  >
                    Create an account
                  </Link>
                </>
              )}

              {currentEmail && !emailMatches && (
                <>
                  <div className="bg-destructive/10 text-destructive text-sm rounded-lg px-4 py-3">
                    This invite is bound to {inviteInfo.email}. Please sign in
                    with that email, or ask the admin to re-invite{" "}
                    {currentEmail}.
                  </div>
                  <Link
                    href="/login?next=/invite"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "lg" }),
                      "w-full",
                    )}
                  >
                    Switch account
                  </Link>
                </>
              )}

              {currentEmail && emailMatches && (
                <Button
                  size="lg"
                  className="w-full"
                  disabled={accepting}
                  onClick={handleAccept}
                >
                  {accepting ? "Accepting..." : "Accept invite"}
                </Button>
              )}

              <p className="text-center text-xs text-muted-foreground">
                Invite links expire after 24 hours.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
