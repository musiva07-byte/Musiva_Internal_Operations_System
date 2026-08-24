import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * Consistent "Back to X" navigation link for detail/edit/action pages — placed near the top of
 * the page, under the breadcrumb and above the title, so staff never have to rely on the
 * browser back button.
 */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-8 items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-musiva-plum"
    >
      <ArrowLeft aria-hidden className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
}
