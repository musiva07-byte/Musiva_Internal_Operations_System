import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Staff Login",
};

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/admin/dashboard");
  }

  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-musiva-ivory px-6 py-12 before:absolute before:-left-28 before:top-10 before:-z-10 before:h-80 before:w-80 before:rounded-full before:bg-musiva-mauve-soft/45 before:blur-3xl after:absolute after:-right-24 after:bottom-0 after:-z-10 after:h-72 after:w-72 after:rounded-full after:bg-musiva-champagne/15 after:blur-3xl">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Image
            alt="Moosiva Lux Wear"
            className="mx-auto h-44 w-44 rounded-full border border-musiva-champagne/60 object-cover shadow-soft sm:h-48 sm:w-48"
            height={192}
            priority
            src="/moosiva-lux-wear-logo.jpeg"
            width={192}
          />
          <h1 className="mt-7 font-display text-3xl font-semibold text-musiva-plum">
            Staff operations login
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Secure access for boutique operations, sales, fulfilment, and management staff.
          </p>
        </div>
        <Suspense fallback={<div className="h-80 rounded-md border bg-card shadow-soft" />}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
