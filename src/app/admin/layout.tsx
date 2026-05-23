import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { LogoutButton } from "@/components/admin/logout-button";
import { canAccessAdmin } from "@/lib/auth/permissions";
import { getCurrentAuthState } from "@/lib/auth/session";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user, profile } = await getCurrentAuthState();

  if (!user) {
    redirect("/login?next=/admin/dashboard");
  }

  if (!profile || !canAccessAdmin(profile.role)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-musiva-ivory px-6 py-12 text-musiva-ink">
        <section className="w-full max-w-md rounded-md border bg-musiva-porcelain p-6 shadow-soft">
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">Access blocked</p>
          <h1 className="mt-3 text-2xl font-semibold text-musiva-plum">Staff profile required</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Your account is signed in, but it does not have an active Musiva staff profile. Please contact the owner.
          </p>
        </section>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-musiva-ivory text-musiva-ink">
      <AdminSidebar />
      <main className="min-h-screen lg:pl-72">
        <div className="flex items-center justify-between gap-4 border-b bg-musiva-porcelain px-5 py-4 lg:hidden">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-musiva-gold">
              Moosiva
            </p>
            <h2 className="mt-1 text-lg font-semibold text-musiva-plum">Musiva Lux Wear</h2>
          </div>
          <LogoutButton />
        </div>
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-6 md:px-8 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
