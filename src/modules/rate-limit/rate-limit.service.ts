import type { SupabaseClient } from "@supabase/supabase-js";

export type RateLimitConfig = {
  action: string;
  key: string;
  limit: number;
  windowSeconds: number;
};

export type RateLimitResult = {
  allowed: boolean;
  currentCount: number;
  retryAfterSeconds: number;
};

type ConsumeRateLimitRow = {
  allowed: boolean;
  current_count: number;
  retry_after_seconds: number;
};

export async function consumeRateLimit(
  supabase: SupabaseClient,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const { data, error } = await supabase
    .rpc("consume_rate_limit", {
      p_action: config.action,
      p_key: config.key,
      p_limit: config.limit,
      p_window_seconds: config.windowSeconds
    })
    .single();

  if (error || !data) {
    return {
      allowed: false,
      currentCount: 0,
      retryAfterSeconds: config.windowSeconds
    };
  }

  const row = data as ConsumeRateLimitRow;

  return {
    allowed: row.allowed,
    currentCount: row.current_count,
    retryAfterSeconds: row.retry_after_seconds
  };
}

export function createRateLimitKey(parts: Array<string | null | undefined>) {
  return parts.map((part) => part?.trim().toLowerCase() || "unknown").join(":");
}

export function getRequestIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
