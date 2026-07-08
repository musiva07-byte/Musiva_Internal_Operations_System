import Image from "next/image";

export function BrandMark() {
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
        <p className="text-xs uppercase tracking-[0.22em] text-musiva-mauve">Bahrain Boutique</p>
      </div>
    </div>
  );
}
