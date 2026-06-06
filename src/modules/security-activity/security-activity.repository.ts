import type { SupabaseClient } from "@supabase/supabase-js";
import type { SecurityActivityLoadResult } from "./security-activity.types";
import { normalizeSecurityActivityEvent } from "./security-activity.service";

export async function listSecurityActivityEvents(
  supabase: SupabaseClient,
  userId: string,
  limit = 50
): Promise<SecurityActivityLoadResult> {
  const { data, error } = await supabase
    .from("security_events")
    .select("id,event_type,severity,ip_address,user_agent,metadata,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return {
      ok: false,
      events: [],
      message: "Security activity could not be loaded right now."
    };
  }

  return {
    ok: true,
    events: (data ?? []).map(normalizeSecurityActivityEvent)
  };
}

