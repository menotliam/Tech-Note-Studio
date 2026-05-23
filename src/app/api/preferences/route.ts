import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { userPreferencesPatchSchema } from "@/modules/preferences/preferences.schemas";
import { updateUserPreferences } from "@/modules/preferences/preferences.service";
import { getSecurityRequestContext, logSecurityEvent } from "@/modules/security/security.repository";

export async function PATCH(request: NextRequest) {
  const requestContext = getSecurityRequestContext(request);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await readJsonBody(request);

  if (!body.ok) {
    await logSecurityEvent(supabase, {
      userId: user.id,
      eventType: "PREFERENCES_UPDATE_REJECTED",
      severity: "warning",
      ...requestContext,
      metadata: { reason: "invalid_json" }
    });
    return NextResponse.json({ error: "Invalid preferences request." }, { status: 400 });
  }

  const parsed = userPreferencesPatchSchema.safeParse(body.value);

  if (!parsed.success) {
    await logSecurityEvent(supabase, {
      userId: user.id,
      eventType: "PREFERENCES_UPDATE_REJECTED",
      severity: "warning",
      ...requestContext,
      metadata: { issues: parsed.error.issues.map((issue) => issue.message) }
    });
    return NextResponse.json({ error: "Invalid preferences request." }, { status: 400 });
  }

  try {
    const preferences = await updateUserPreferences(supabase, user.id, parsed.data);

    await logSecurityEvent(supabase, {
      userId: user.id,
      eventType: "PREFERENCES_UPDATED",
      severity: "info",
      ...requestContext,
      metadata: { groups: Object.keys(parsed.data) }
    });

    return NextResponse.json({ preferences });
  } catch (error) {
    await logSecurityEvent(supabase, {
      userId: user.id,
      eventType: "PREFERENCES_UPDATE_REJECTED",
      severity: "warning",
      ...requestContext,
      metadata: { reason: "database_error", message: error instanceof Error ? error.message : "Unknown error" }
    });
    return NextResponse.json({ error: "Could not update preferences." }, { status: 500 });
  }
}

async function readJsonBody(request: NextRequest): Promise<{ ok: true; value: unknown } | { ok: false }> {
  try {
    return { ok: true, value: await request.json() };
  } catch {
    return { ok: false };
  }
}
