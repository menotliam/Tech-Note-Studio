"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureUserFoundation } from "@/modules/workspace/workspace.service";
import { loginSchema, signupSchema } from "./auth.schemas";
import type { AuthActionState } from "./auth.types";

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function getNextPath(formData: FormData) {
  const next = getFormString(formData, "next");
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function loginAction(
  _previousState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: getFormString(formData, "email"),
    password: getFormString(formData, "password")
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid login details."
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error || !data.user) {
    return {
      status: "error",
      message: "Email or password is incorrect."
    };
  }

  try {
    await ensureUserFoundation(supabase, data.user);
  } catch {
    return {
      status: "error",
      message: "Signed in, but workspace setup failed. Please try again."
    };
  }

  redirect(getNextPath(formData));
}

export async function signupAction(
  _previousState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const displayName = getFormString(formData, "displayName");
  const parsed = signupSchema.safeParse({
    email: getFormString(formData, "email"),
    password: getFormString(formData, "password"),
    displayName: displayName || undefined
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid sign up details."
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        display_name: parsed.data.displayName
      },
      emailRedirectTo: `${process.env.APP_URL ?? "http://localhost:3000"}/auth/callback`
    }
  });

  if (error) {
    return {
      status: "error",
      message: "Could not create an account with those details."
    };
  }

  if (data.user && data.session) {
    try {
      await ensureUserFoundation(supabase, data.user, parsed.data.displayName);
    } catch {
      return {
        status: "error",
        message: "Account created, but workspace setup failed. Please log in again."
      };
    }

    redirect("/");
  }

  return {
    status: "success",
    message: "If this email can be used, you will receive a confirmation link."
  };
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
