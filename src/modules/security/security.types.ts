export type SecurityEventSeverity = "info" | "warning" | "critical";

export type SecurityEventType =
  | "INVALID_EXPORT_REQUEST"
  | "EXPORT_ACCESS_DENIED"
  | "EXPORT_FAILED"
  | "FILE_UPLOAD_REJECTED"
  | "NOTE_UPDATE_FAILED"
  | "PREFERENCES_UPDATED"
  | "PREFERENCES_UPDATE_REJECTED";

export type SecurityEventInput = {
  userId: string | null;
  eventType: SecurityEventType;
  severity: SecurityEventSeverity;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
};
