import type {
  SecurityActivityCategory,
  SecurityActivityEvent,
  SecurityActivitySeverity
} from "./security-activity.types";

type RawSecurityActivityEvent = {
  id?: unknown;
  event_type?: unknown;
  severity?: unknown;
  ip_address?: unknown;
  user_agent?: unknown;
  metadata?: unknown;
  created_at?: unknown;
};

const eventDisplay: Record<
  string,
  {
    category: SecurityActivityCategory;
    title: string;
    description: string;
  }
> = {
  EXPORT_ACCESS_DENIED: {
    category: "export",
    title: "Export access denied",
    description: "An export request tried to include a note that was not available to this account."
  },
  EXPORT_FAILED: {
    category: "export",
    title: "Export failed",
    description: "A document export failed before a downloadable file could be prepared."
  },
  FILE_UPLOAD_REJECTED: {
    category: "storage",
    title: "Image upload rejected",
    description: "An image upload was blocked because it did not pass validation."
  },
  INVALID_EXPORT_REQUEST: {
    category: "export",
    title: "Invalid export request",
    description: "An export request was rejected before processing."
  },
  NOTE_UPDATE_FAILED: {
    category: "workspace",
    title: "Note update failed",
    description: "A note save attempt failed and was recorded for review."
  },
  PREFERENCES_UPDATED: {
    category: "preferences",
    title: "Preferences updated",
    description: "Your application preferences were changed."
  },
  PREFERENCES_UPDATE_REJECTED: {
    category: "preferences",
    title: "Preferences update rejected",
    description: "A preferences update did not pass validation."
  },
  TRASH_CLEANUP_COMPLETED: {
    category: "system",
    title: "Trash cleanup completed",
    description: "Expired trashed notes were permanently cleaned up."
  },
  TRASH_CLEANUP_FAILED: {
    category: "system",
    title: "Trash cleanup failed",
    description: "Automatic trash cleanup did not complete."
  },
  TRASH_CLEANUP_STARTED: {
    category: "system",
    title: "Trash cleanup started",
    description: "Automatic cleanup started checking expired trashed notes."
  }
};

const metadataLabels: Record<string, string> = {
  affectedNotes: "Affected notes",
  count: "Count",
  errorCode: "Failure code",
  format: "Format",
  groups: "Updated groups",
  issues: "Validation issues",
  mimeType: "MIME type",
  mode: "Mode",
  noteId: "Note",
  reason: "Reason",
  rejectedReason: "Reason",
  requestedNoteCount: "Requested notes",
  requestType: "Request",
  returnedNoteCount: "Available notes",
  size: "Size",
  updatedSections: "Updated sections"
};

export const securityActivityCategories: Array<{ id: "all" | SecurityActivityCategory; label: string }> = [
  { id: "all", label: "All" },
  { id: "preferences", label: "Preferences" },
  { id: "workspace", label: "Workspace" },
  { id: "export", label: "Export" },
  { id: "storage", label: "Uploads" },
  { id: "system", label: "System" },
  { id: "account", label: "Account" }
];

export function normalizeSecurityActivityEvent(raw: RawSecurityActivityEvent): SecurityActivityEvent {
  const eventType = readString(raw.event_type) || "UNKNOWN_EVENT";
  const display = eventDisplay[eventType] ?? {
    category: "account" as const,
    title: titleFromEventType(eventType),
    description: "A security-relevant account event was recorded."
  };

  return {
    id: readString(raw.id) || `${eventType}-${readString(raw.created_at)}`,
    eventType,
    category: display.category,
    severity: normalizeSeverity(raw.severity),
    title: display.title,
    description: display.description,
    metadata: normalizeMetadata(raw.metadata),
    ipAddress: readNullableString(raw.ip_address),
    userAgent: readNullableString(raw.user_agent),
    createdAt: readString(raw.created_at) || new Date(0).toISOString()
  };
}

function normalizeSeverity(value: unknown): SecurityActivitySeverity {
  return value === "warning" || value === "critical" ? value : "info";
}

function normalizeMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  return Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !isSensitiveMetadataKey(key))
    .slice(0, 6)
    .map(([key, metadataValue]) => ({
      label: metadataLabels[key] ?? titleFromMetadataKey(key),
      value: formatMetadataValue(metadataValue)
    }))
    .filter((item) => item.value.length > 0);
}

function isSensitiveMetadataKey(key: string) {
  return /token|secret|password|path|stack|service|binary|content|message/i.test(key);
}

function formatMetadataValue(value: unknown): string {
  if (typeof value === "string") {
    return value.slice(0, 120);
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (Array.isArray(value)) {
    return value.map(formatMetadataValue).filter(Boolean).join(", ").slice(0, 120);
  }

  return "";
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readNullableString(value: unknown) {
  const text = readString(value);
  return text ? text.slice(0, 160) : null;
}

function titleFromEventType(eventType: string) {
  return eventType
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function titleFromMetadataKey(key: string) {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_.-]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
