"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Musiva] Unhandled error:", error);
  }, [error]);

  const isPausedDb =
    error?.message?.toLowerCase().includes("connection") ||
    error?.message?.toLowerCase().includes("unavailable") ||
    error?.message?.toLowerCase().includes("econnrefused") ||
    error?.message?.toLowerCase().includes("timeout");

  return (
    <html lang="en">
      <body className="min-h-screen bg-[#FBF7F5] text-[#2E2325] font-sans antialiased">
        <main className="flex min-h-screen items-center justify-center px-6 py-12">
          <section className="w-full max-w-md rounded-lg border border-[#E7D8D5] bg-white p-8 shadow-sm">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 flex-shrink-0 text-[#A8753A]" aria-hidden />
              <p className="text-sm font-semibold uppercase tracking-widest text-[#A8753A]">
                System error
              </p>
            </div>

            <h1 className="mt-4 text-2xl font-semibold text-[#9B5F68]">
              {isPausedDb ? "Database unavailable" : "Something went wrong"}
            </h1>

            <p className="mt-3 text-sm leading-6 text-[#746267]">
              {isPausedDb
                ? "The database is currently unavailable. Please contact the system administrator."
                : "An unexpected error occurred. Please try refreshing the page. If the problem persists, contact the system administrator."}
            </p>

            {isPausedDb && (
              <div className="mt-4 rounded-md border border-[#E7D8D5] bg-[#FBF7F5] p-4 text-xs text-[#746267]">
                <p className="font-semibold text-[#5A353B]">Administrator note</p>
                <p className="mt-1 leading-5">
                  Supabase Free projects pause automatically after 7 days of inactivity. Log in to
                  the Supabase dashboard and click <strong>Restore</strong> to unpause the project.
                  The first query after restore may take 10–30 seconds.
                </p>
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <Button onClick={reset} className="gap-2">
                <RefreshCw className="h-4 w-4" aria-hidden />
                Try again
              </Button>
              <Button variant="outline" onClick={() => (window.location.href = "/login")}>
                Go to login
              </Button>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
