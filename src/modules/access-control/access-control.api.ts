import type { SupabaseClient, User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { evaluateAppAccess } from "./access-control.service";
import type { AppRole } from "./access-control.types";

export type ApiAccessAllowed = {
  ok: true;
  user: User;
  role: AppRole;
};

export type ApiAccessDenied = {
  ok: false;
  response: NextResponse;
};

export async function requireApiAccess(supabase: SupabaseClient): Promise<ApiAccessAllowed | ApiAccessDenied> {
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized." }, { status: 401 })
    };
  }

  const access = await evaluateAppAccess(supabase, user);

  if (!access.allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: access.reason === "email_unverified" ? "Email verification required." : "Access denied." },
        { status: 403 }
      )
    };
  }

  return {
    ok: true,
    user,
    role: access.role
  };
}
