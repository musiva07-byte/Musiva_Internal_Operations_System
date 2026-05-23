"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { hasSupabaseEnv } from "@/lib/supabase/config";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nextPath = useMemo(() => {
    const value = searchParams.get("next");
    return value?.startsWith("/") ? value : "/admin/dashboard";
  }, [searchParams]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase environment variables are required before staff login can be used.");
      return;
    }

    setIsSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setIsSubmitting(false);
      setError(signInError.message);
      return;
    }

    router.replace(nextPath);
    router.refresh();
  }

  return (
    <Card className="border-musiva-champagne/70 bg-musiva-porcelain shadow-soft">
      <CardHeader>
        <CardTitle className="text-xl text-musiva-plum">Sign in</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasSupabaseEnv ? (
          <div className="mb-5 rounded-md border border-musiva-gold/30 bg-musiva-ivory p-3 text-sm leading-5 text-muted-foreground">
            Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to enable
            authentication.
          </div>
        ) : null}

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <div className="relative">
              <Mail
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="email"
                autoComplete="email"
                className="pl-10"
                disabled={isSubmitting}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="staff@musiva.com"
                required
                type="email"
                value={email}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <LockKeyhole
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="password"
                autoComplete="current-password"
                className="pl-10"
                disabled={isSubmitting}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </div>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <Button aria-busy={isSubmitting} className="w-full" disabled={isSubmitting} type="submit">
            {isSubmitting ? (
              <>
                <LoaderCircle aria-hidden className="mr-2 h-4 w-4 animate-spin" />
                Opening dashboard...
              </>
            ) : (
              "Sign in to operations"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
