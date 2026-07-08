"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

type LogoutButtonProps = {
  className?: string;
  variant?: "button" | "sidebar";
};

export function LogoutButton({ className, variant = "button" }: LogoutButtonProps) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleLogout() {
    setIsSigningOut(true);

    const supabase = createSupabaseBrowserClient();
    if (supabase) {
      await supabase.auth.signOut();
    }

    router.replace("/login");
    router.refresh();
  }

  if (variant === "sidebar") {
    return (
      <button
        className={cn(
          "flex min-h-10 w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-musiva-plum/85 transition-colors hover:bg-musiva-mauve-soft/45 hover:text-musiva-plum disabled:cursor-not-allowed disabled:opacity-60",
          className,
        )}
        disabled={isSigningOut}
        onClick={handleLogout}
        type="button"
      >
        <LogOut aria-hidden className="h-4 w-4" />
        <span>{isSigningOut ? "Signing out..." : "Logout"}</span>
      </button>
    );
  }

  return (
    <Button className={className} disabled={isSigningOut} onClick={handleLogout} type="button" variant="outline">
      <LogOut aria-hidden className="h-4 w-4 sm:mr-2" />
      <span>{isSigningOut ? "Signing out..." : "Logout"}</span>
    </Button>
  );
}
