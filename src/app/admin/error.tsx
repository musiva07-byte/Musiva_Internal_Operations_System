"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Musiva Admin] Unhandled error:", error);
  }, [error]);

  const isPausedDb =
    error?.message?.toLowerCase().includes("connection") ||
    error?.message?.toLowerCase().includes("unavailable") ||
    error?.message?.toLowerCase().includes("econnrefused") ||
    error?.message?.toLowerCase().includes("timeout") ||
    error?.message?.toLowerCase().includes("fetch failed");

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6">
      <section className="w-full max-w-lg rounded-lg border border-musiva-border bg-card p-8 shadow-soft">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-musiva-warning" aria-hidden />
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-musiva-warning">
            {isPausedDb ? "Database unavailable" : "Unexpected error"}
          </p>
        </div>

        <h1 className="mt-4 text-xl font-semibold text-musiva-plum">
          {isPausedDb
            ? "The database is currently unavailable."
            : "Something went wrong on this page."}
        </h1>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {isPausedDb
            ? "Please contact the system administrator. The system will be available again once the database is restored."
            : "An unexpected error occurred. You can try refreshing, or navigate to another page. If this keeps happening, contact the system administrator."}
        </p>

        {isPausedDb && (
          <div className="mt-5 rounded-md border border-musiva-border bg-musiva-ivory p-4 text-xs text-muted-foreground">
            <p className="font-semibold text-musiva-plum">For the administrator</p>
            <p className="mt-1 leading-5">
              Supabase Free projects pause after 7 days of inactivity. Log in to the{" "}
              <strong>Supabase dashboard</strong> → select the project → click{" "}
              <strong>Restore project</strong>. The first request after restore may take 10–30
              seconds while the database wakes up.
            </p>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={reset} className="gap-2">
            <RefreshCw className="h-4 w-4" aria-hidden />
            Try again
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/dashboard">Dashboard</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
