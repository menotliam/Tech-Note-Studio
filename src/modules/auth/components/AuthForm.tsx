"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { AuthActionState } from "@/modules/auth/auth.types";
import { initialAuthActionState } from "@/modules/auth/auth.types";

type AuthFormProps = {
  mode: "login" | "signup";
  action: (previousState: AuthActionState, formData: FormData) => Promise<AuthActionState>;
  next?: string;
};

export function AuthForm({ mode, action, next = "/" }: AuthFormProps) {
  const [state, formAction] = useActionState(action, initialAuthActionState);
  const isSignup = mode === "signup";

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />

      {isSignup ? (
        <label className="block text-sm font-medium">
          Display name
          <input
            name="displayName"
            className="mt-1 h-11 w-full rounded-md border border-border bg-background px-3 outline-none focus:border-primary"
            placeholder="Your name"
            maxLength={80}
          />
        </label>
      ) : null}

      <label className="block text-sm font-medium">
        Email
        <input
          name="email"
          type="email"
          className="mt-1 h-11 w-full rounded-md border border-border bg-background px-3 outline-none focus:border-primary"
          placeholder="you@example.com"
          required
        />
      </label>

      <label className="block text-sm font-medium">
        Password
        <input
          name="password"
          type="password"
          className="mt-1 h-11 w-full rounded-md border border-border bg-background px-3 outline-none focus:border-primary"
          placeholder={isSignup ? "At least 8 characters and 1 number" : "Your password"}
          required
        />
      </label>

      {state.message ? (
        <p
          className={
            "rounded-md border px-3 py-2 text-sm " +
            (state.status === "success"
              ? "border-primary bg-muted text-foreground"
              : "border-red-200 bg-red-50 text-red-700")
          }
        >
          {state.message}
        </p>
      ) : null}

      <SubmitButton label={isSignup ? "Create account" : "Log in"} />

      <p className="text-sm text-muted-foreground">
        {isSignup ? "Already have an account?" : "New to TechNote Studio?"}{" "}
        <Link className="font-medium text-primary hover:underline" href={isSignup ? "/login" : "/signup"}>
          {isSignup ? "Log in" : "Create an account"}
        </Link>
      </p>
    </form>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      className="h-11 w-full rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
      disabled={pending}
    >
      {pending ? "Working..." : label}
    </button>
  );
}
