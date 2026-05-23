import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { LogoutButton } from "@/components/admin/logout-button";
import { MobileAdminNav } from "@/components/admin/mobile-admin-nav";
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
        <div className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b bg-musiva-porcelain/95 px-4 py-4 backdrop-blur lg:hidden">
          <MobileAdminNav />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-musiva-gold">
              Moosiva
            </p>
            <h2 className="mt-1 truncate text-base font-semibold text-musiva-plum">Musiva Lux Wear</h2>
          </div>
          <LogoutButton className="px-3 [&>span]:sr-only sm:px-4 sm:[&>span]:not-sr-only" />
        </div>
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-5 md:gap-8 md:px-8 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
