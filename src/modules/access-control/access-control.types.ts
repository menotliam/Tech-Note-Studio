export const appRoleValues = ["owner", "admin", "member"] as const;

export type AppRole = (typeof appRoleValues)[number];

export type AppAccessDeniedReason =
  | "unauthenticated"
  | "missing_email"
  | "domain_not_allowed"
  | "email_unverified"
  | "disabled"
  | "access_check_failed";

export type AppAccessAllowed = {
  allowed: true;
  role: AppRole;
};

export type AppAccessDenied = {
  allowed: false;
  reason: AppAccessDeniedReason;
  role: AppRole | null;
  redirectTo: string;
};

export type AppAccessResult = AppAccessAllowed | AppAccessDenied;
