import { AuthForm } from "@/modules/auth/components/AuthForm";
import { AuthPageShell } from "@/modules/auth/components/AuthPageShell";
import { signupAction } from "@/modules/auth/auth.actions";

export default function SignupPage() {
  return (
    <AuthPageShell title="Create account" subtitle="Start with a secure personal workspace.">
      <AuthForm mode="signup" action={signupAction} />
    </AuthPageShell>
  );
}
