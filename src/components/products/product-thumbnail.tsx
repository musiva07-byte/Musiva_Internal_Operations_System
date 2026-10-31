import Image from "next/image";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { isUsableImageUrl } from "@/lib/utils/product-image";

type ProductThumbnailProps = {
  url: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
};

export function ProductThumbnail({ url, name, size = "md" }: ProductThumbnailProps) {
  const dimensions = {
    sm: { className: "h-[52px] w-10", sizes: "64px" },
    md: { className: "h-16 w-12", sizes: "64px" },
    lg: { className: "h-56 w-44", sizes: "176px" },
  }[size];

  if (!isUsableImageUrl(url)) {
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
        sizes={dimensions.sizes}
        src={url}
      />
    </div>
  );
}
