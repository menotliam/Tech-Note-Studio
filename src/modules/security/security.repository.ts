import type { SupabaseClient } from "@supabase/supabase-js";
import type { SecurityEventInput } from "./security.types";

export async function logSecurityEvent(supabase: SupabaseClient, event: SecurityEventInput) {
  const { error } = await supabase.from("security_events").insert({
    user_id: event.userId,
    event_type: event.eventType,
    severity: event.severity,
    ip_address: event.ipAddress,
    user_agent: event.userAgent,
    metadata: sanitizeMetadata(event.metadata ?? {})
  });

  if (error) {
    return { ok: false as const, error };
  }

  return { ok: true as const };
}

export function getSecurityRequestContext(request: Request) {
  return {
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: request.headers.get("user-agent")
  };
}

function sanitizeMetadata(metadata: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([key]) => /^[a-zA-Z0-9_.-]{1,80}$/.test(key))
      .map(([key, value]) => [key, sanitizeMetadataValue(value)])
  );
}

function sanitizeMetadataValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value.slice(0, 500);
  }

  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map(sanitizeMetadataValue);
  }

  if (typeof value === "object" && value !== null) {
    return sanitizeMetadata(value as Record<string, unknown>);
  }

  return String(value).slice(0, 500);
}
