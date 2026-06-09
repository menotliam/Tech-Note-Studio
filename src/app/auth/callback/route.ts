import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { evaluateAppAccess } from "@/modules/access-control/access-control.service";
import { ensureUserFoundation } from "@/modules/workspace/workspace.service";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.exchangeCodeForSession(code);

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (user) {
      const access = await evaluateAppAccess(supabase, user);

      if (!access.allowed) {
        return NextResponse.redirect(new URL(access.redirectTo, requestUrl.origin));
      }

      await ensureUserFoundation(
        supabase,
        user,
        typeof user.user_metadata.display_name === "string"
          ? user.user_metadata.display_name
          : undefined
      );
    }
  }

  return NextResponse.redirect(new URL(next.startsWith("/") ? next : "/", requestUrl.origin));
}
