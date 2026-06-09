import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { AppAccessDeniedReason, AppAccessResult, AppRole } from "./access-control.types";

type UserAccessRow = {
  role: string;
  disabled_at: string | null;
};

type AllowedEmailDomainRow = {
  domain: string;
};

const privilegedRoles = new Set<AppRole>(["owner", "admin"]);

export async function evaluateAppAccess(
  supabase: SupabaseClient,
  user: User | null
): Promise<AppAccessResult> {
  if (!user) {
    return deny("unauthenticated", null, "/login");
  }

  try {
    const access = await ensureUserAccessRecord(supabase, user.id);
    const role = normalizeRole(access.role);

    if (access.disabled_at) {
      return deny("disabled", role, "/access-denied?reason=disabled");
    }

    const email = user.email?.trim().toLowerCase();
    const domain = getEmailDomain(email);

    if (!email || !domain) {
      return deny("missing_email", role, "/access-denied?reason=missing-email");
    }

    if (!privilegedRoles.has(role)) {
      const allowedDomains = await listAllowedEmailDomains(supabase);

      if (!allowedDomains.has(domain)) {
        return deny("domain_not_allowed", role, "/access-denied?reason=domain");
      }
    }

    if (!isEmailVerified(user)) {
      return deny("email_unverified", role, "/verify-email");
    }

    return { allowed: true, role };
  } catch {
    return deny("access_check_failed", null, "/access-denied?reason=access-check");
  }
}

export function canCreateEncryptedTestWorkspace(role: AppRole) {
  return role === "owner";
}

export function isAdminRole(role: AppRole) {
  return role === "owner" || role === "admin";
}

export function getEmailDomain(email: string | null | undefined) {
  if (!email) {
    return null;
  }

  const atIndex = email.lastIndexOf("@");

  if (atIndex <= 0 || atIndex === email.length - 1) {
    return null;
  }

  return email.slice(atIndex + 1).toLowerCase();
}

export function isEmailVerified(user: User) {
  const candidate = user.email_confirmed_at ?? (user as User & { confirmed_at?: string | null }).confirmed_at;
  return typeof candidate === "string" && candidate.length > 0;
}

async function ensureUserAccessRecord(supabase: SupabaseClient, userId: string): Promise<UserAccessRow> {
  const existing = await selectUserAccessRecord(supabase, userId);

  if (existing) {
    return existing;
  }

  const { error: insertError } = await supabase.from("user_access").insert({
    user_id: userId,
    role: "member"
  });

  if (insertError) {
    const raced = await selectUserAccessRecord(supabase, userId);

    if (raced) {
      return raced;
    }

    throw insertError;
  }

  const created = await selectUserAccessRecord(supabase, userId);

  if (!created) {
    throw new Error("User access record was not created.");
  }

  return created;
}

async function selectUserAccessRecord(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("user_access")
    .select("role, disabled_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as UserAccessRow | null;
}

async function listAllowedEmailDomains(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("allowed_email_domains")
    .select("domain")
    .eq("is_active", true);

  if (error) {
    throw error;
  }

  return new Set((data as AllowedEmailDomainRow[]).map((row) => row.domain.toLowerCase()));
}

function normalizeRole(role: string): AppRole {
  return role === "owner" || role === "admin" || role === "member" ? role : "member";
}

function deny(reason: AppAccessDeniedReason, role: AppRole | null, redirectTo: string): AppAccessResult {
  return {
    allowed: false,
    reason,
    role,
    redirectTo
  };
}
