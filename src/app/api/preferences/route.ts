import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireApiAccess } from "@/modules/access-control/access-control.api";
import { userPreferencesPatchSchema } from "@/modules/preferences/preferences.schemas";
import { isSameOriginRequest } from "@/modules/security/csrf";
import { updateUserPreferences } from "@/modules/preferences/preferences.service";
import { getSecurityRequestContext, logSecurityEvent } from "@/modules/security/security.repository";

export async function PATCH(request: NextRequest) {
  const requestContext = getSecurityRequestContext(request);

  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Invalid preferences request." }, { status: 403 });
  }

  const supabase = await createSupabaseServerClient();
  const access = await requireApiAccess(supabase);

  if (!access.ok) {
    return access.response;
  }

  const { user } = access;

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
