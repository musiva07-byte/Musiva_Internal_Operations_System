import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-md rounded-lg border border-[#E7D8D5] bg-white p-8 text-center shadow-sm">
        <FileQuestion className="mx-auto h-8 w-8 text-[#A8753A]" aria-hidden />
        <h1 className="mt-4 text-2xl font-semibold text-[#9B5F68]">Page not found</h1>
        <p className="mt-3 text-sm leading-6 text-[#746267]">
          The page you are looking for does not exist or may have been moved.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild>
            <Link href="/admin/dashboard">Dashboard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/login">Login</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
