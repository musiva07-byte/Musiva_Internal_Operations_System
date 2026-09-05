import type { ReactNode } from "react";

/**
 * Standard header for list pages (and any page that doesn't need the
 * Breadcrumb + BackLink detail/edit treatment). Consolidates the eyebrow /
 * title / description / actions pattern that was previously hand-rolled in
 * every page.tsx into one place — see AGENTS.md navigation rules: "List
 * pages: show PageHeader ... primary action button on top-right".
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  breadcrumb,
  primaryActions,
  secondaryActions,
  summary,
}: {
  /** Uppercase module label shown above the title. Ignored when `breadcrumb` is given. */
  eyebrow?: string;
  title: string;
  description?: string;
  /** A <Breadcrumb /> to show instead of the plain eyebrow label. */
  breadcrumb?: ReactNode;
  /** Buttons shown top-right, e.g. "New product". */
  primaryActions?: ReactNode;
  /** Lower-emphasis buttons shown alongside primaryActions, e.g. "Export". */
  secondaryActions?: ReactNode;
  /** Optional badge/card on the far right, e.g. a total count. */
  summary?: ReactNode;
}) {
  return (
    <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
      <div>
        {breadcrumb ?? (
          eyebrow && (
            <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">{eyebrow}</p>
          )
        )}
        <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">{title}</h1>
        {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
      </div>
      {(primaryActions || secondaryActions || summary) && (
        <div className="flex flex-wrap items-center gap-2">
          {summary}
          {secondaryActions}
          {primaryActions}
        </div>
      )}
    </header>
  );
}
