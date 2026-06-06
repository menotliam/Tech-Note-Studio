export type SecurityActivitySeverity = "info" | "warning" | "critical";

export type SecurityActivityCategory =
  | "account"
  | "export"
  | "preferences"
  | "storage"
  | "system"
  | "workspace";

export type SecurityActivityEvent = {
  id: string;
  eventType: string;
  category: SecurityActivityCategory;
  severity: SecurityActivitySeverity;
  title: string;
  description: string;
  metadata: Array<{ label: string; value: string }>;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

export type SecurityActivityLoadResult =
  | {
      ok: true;
      events: SecurityActivityEvent[];
    }
  | {
      ok: false;
      events: [];
      message: string;
    };

