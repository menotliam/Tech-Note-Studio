import { ShieldAlert } from "lucide-react";
import { logoutAction } from "@/modules/auth/auth.actions";
import { AuthPageShell } from "@/modules/auth/components/AuthPageShell";

export default function AccessDeniedPage() {
  return (
    <AuthPageShell
      title="Access unavailable"
      subtitle="This account cannot enter the workspace with the current beta access policy."
    >
      <div className="space-y-4 rounded-md border border-border bg-panel p-4 text-sm text-muted-foreground">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 text-primary" aria-hidden />
          <p>
            Your account may be outside the allowed email domains, disabled, or temporarily blocked by an access
            policy. Contact the workspace owner if this looks wrong.
          </p>
        </div>
        <form action={logoutAction}>
          <button className="h-10 rounded-md border border-border px-3 text-sm font-medium text-foreground transition hover:bg-muted">
            Sign out
          </button>
        </form>
      </div>
    </AuthPageShell>
  );
}
