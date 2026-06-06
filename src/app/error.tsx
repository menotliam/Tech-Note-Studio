"use client";

import { AlertTriangle } from "lucide-react";
import { ErrorState } from "@/components/ui/error-state";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <ErrorState
        icon={<AlertTriangle size={26} />}
        title="Workspace could not load"
        description="Something interrupted this view. Retry loading the workspace; your local editor work is preserved where offline cache is available."
        action={{ label: "Retry", onClick: reset }}
        className="w-full max-w-md bg-panel/70"
      />
    </main>
  );
}
