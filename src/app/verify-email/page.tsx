import { MailCheck } from "lucide-react";
import { logoutAction } from "@/modules/auth/auth.actions";
import { AuthPageShell } from "@/modules/auth/components/AuthPageShell";

export default function VerifyEmailPage() {
  return (
    <AuthPageShell
      title="Verify your email"
      subtitle="Check your inbox and open the confirmation link before entering your workspace."
    >
      <div className="space-y-4 rounded-md border border-border bg-panel p-4 text-sm text-muted-foreground">
        <div className="flex items-start gap-3">
          <MailCheck className="mt-0.5 h-5 w-5 text-primary" aria-hidden />
          <p>
            Your domain is allowed, but this account still needs email verification. After confirming your email,
            return here and refresh the page.
          </p>
        </div>
        <form action={logoutAction}>
          <button className="h-10 rounded-md border border-border px-3 text-sm font-medium text-foreground transition hover:bg-muted">
            Use another account
          </button>
        </form>
      </div>
    </AuthPageShell>
  );
}
