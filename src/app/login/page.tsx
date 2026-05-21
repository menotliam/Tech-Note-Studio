import { AuthForm } from "@/modules/auth/components/AuthForm";
import { AuthPageShell } from "@/modules/auth/components/AuthPageShell";
import { loginAction } from "@/modules/auth/auth.actions";

export default async function LoginPage({
  searchParams
}: {
  searchParams?: Promise<{ next?: string }>;
}) {
  const params = await searchParams;

  return (
    <AuthPageShell title="Log in" subtitle="Access your private technical notes workspace.">
      <AuthForm mode="login" action={loginAction} next={params?.next ?? "/"} />
    </AuthPageShell>
  );
}
