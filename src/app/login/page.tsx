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
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Image
            alt="Moosiva Lux Wear"
            className="mx-auto h-auto w-full max-w-sm"
            height={164}
            priority
            src="/moosiva-logo.svg"
            width={384}
          />
          <h1 className="mt-7 text-2xl font-semibold text-musiva-plum">
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
