import Image from "next/image";

type BrandMarkProps = {
  /** Defaults to "Bahrain Boutique" (used by the Product Catalog / Stock Management report
   *  headers). The delivery label and receipt pass "Bahrain" for a shorter header. */
  subtitle?: string;
};

export function BrandMark({ subtitle = "Bahrain Boutique" }: BrandMarkProps) {
  return (
    <div className="flex items-center gap-3">
      <Image
        alt="Moosiva Lux Wear"
        className="h-14 w-14 rounded-full border border-musiva-champagne object-cover"
        height={56}
        src="/moosiva-lux-wear-logo.jpeg"
        width={56}
      />
      <div>
        <p className="text-lg font-semibold tracking-wide text-musiva-ink">Moosiva Lux Wear</p>
        <p className="text-xs uppercase tracking-[0.22em] text-musiva-mauve">{subtitle}</p>
      </div>
    </div>
  );
}
