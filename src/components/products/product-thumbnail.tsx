import Image from "next/image";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

type ProductThumbnailProps = {
  url: string | null;
  name: string;
  size?: "sm" | "md";
};

export function ProductThumbnail({ url, name, size = "md" }: ProductThumbnailProps) {
  const dimensions =
    size === "sm"
      ? { width: 40, height: 52, className: "h-[52px] w-10" }
      : { width: 48, height: 64, className: "h-16 w-12" };

  if (!url) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded border border-musiva-border bg-musiva-blush/40",
          dimensions.className,
        )}
        aria-hidden
      >
        <ImageOff className="h-4 w-4 text-muted-foreground/50" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded border border-musiva-border bg-musiva-blush/20",
        dimensions.className,
      )}
    >
      <Image
        alt={name}
        className="object-cover object-top"
        fill
        sizes="64px"
        src={url}
      />
    </div>
  );
}
