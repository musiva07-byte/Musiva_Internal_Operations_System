import Link from "next/link";
import { Button } from "@/components/ui/button";

type PaginationProps = {
  page: number;
  pageCount: number;
  href: (page: number) => string;
};

export function Pagination({ page, pageCount, href }: PaginationProps) {
  if (pageCount <= 1) {
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-sm text-muted-foreground">
        Page {page} of {pageCount}
      </p>
      <div className="flex gap-2">
        <Button asChild disabled={page <= 1} variant="outline">
          <Link aria-disabled={page <= 1} href={href(Math.max(1, page - 1))}>
            Previous
          </Link>
        </Button>
        <Button asChild disabled={page >= pageCount} variant="outline">
          <Link aria-disabled={page >= pageCount} href={href(Math.min(pageCount, page + 1))}>
            Next
          </Link>
        </Button>
      </div>
    </div>
  );
}
