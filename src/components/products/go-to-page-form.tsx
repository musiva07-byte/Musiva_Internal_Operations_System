"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { parseGoToPage } from "@/lib/utils/pagination";

/**
 * The only interactive part of Pagination. Split into its own client component because
 * Pagination itself is rendered directly from Server Component pages with a plain `href`
 * function prop (`href: (page: number) => string`) — functions cannot cross the server/client
 * boundary, so Pagination must stay server-renderable. This component instead takes a plain,
 * serializable string (`sampleHref`, i.e. `href(1)`) and edits its `page` query param on submit.
 */
export function GoToPageForm({ pageCount, sampleHref }: { pageCount: number; sampleHref: string }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = parseGoToPage(value, pageCount);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setValue("");
    const url = new URL(sampleHref, "http://localhost");
    url.searchParams.set("page", String(result.page));
    router.push(`${url.pathname}${url.search}`);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-wrap items-center gap-2">
      <label htmlFor="pagination-go-to-page" className="text-xs text-muted-foreground">
        Go to page
      </label>
      <input
        id="pagination-go-to-page"
        type="number"
        min={1}
        max={pageCount}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setError(null);
        }}
        className="h-8 w-16 rounded-md border border-musiva-border bg-white px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <Button type="submit" size="sm" variant="outline">
        Go
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </form>
  );
}
