"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ImagePlus, ImageOff, Loader2, Star, Trash2, Upload, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  removeProductImageAction,
  setProductCoverImageAction,
  uploadProductImageAction,
} from "@/app/admin/products/image-actions";
import {
  buildColorImageCards,
  colorDisplayName,
  isUsableImageUrl,
  type ColorImageCard,
} from "@/lib/utils/product-image";
import type { ProductImageRow } from "@/types/database";

// Vercel Functions hard-cap every request body at 4.5 MB (infrastructure-level, not
// configurable). This must stay comfortably under that — see product-image.service.ts and
// next.config.ts, which use the same 4 MB limit for the same reason.
const MAX_SIZE_MB = 4;
const MAX_BYTES = MAX_SIZE_MB * 1024 * 1024;
const ACCEPT = ".jpg,.jpeg,.png,.webp";
const ACCEPT_MIME = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const UPLOAD_ERROR = "Could not upload this photo. Please try again.";
const REMOVE_ERROR = "Could not remove this photo. Please try again.";
const COVER_ERROR = "Could not change the cover photo. Please try again.";

type Card = ColorImageCard<ProductImageRow>;
type Notice = { tone: "success" | "error"; text: string };

type Props = {
  productId: string;
  /** The product's variant colors. Repeats (one per size) collapse into a single card. */
  colors: string[];
  images: ProductImageRow[];
  canEdit: boolean;
};

function photoName(card: Card): string {
  return card.color ? colorDisplayName(card.color) : "General";
}

function statusText(card: Card): string {
  if (!card.image) return "Photo not added";
  if (card.kind === "retired-color") return "Color no longer on this product";
  if (card.kind === "general") return "Older product-wide photo";
  return "Photo added";
}

function CardPhoto({ url, alt }: { url: string | null | undefined; alt: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (!isUsableImageUrl(url) || failedUrl === url) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-muted-foreground">
        <ImageOff aria-hidden className="h-7 w-7 opacity-50" />
        <span className="text-xs">Photo unavailable</span>
      </div>
    );
  }

  return (
    <Image
      alt={alt}
      className="object-cover object-top"
      fill
      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 260px"
      src={url}
      onError={() => setFailedUrl(url)}
    />
  );
}

/**
 * The Product Images section (Edit Product and New Product): one 4:5 card per color, each with
 * its own upload/replace/remove, plus "Set as cover" to reuse any photo as the listing image.
 * Touches only product_images through the image actions — never the product form, so nothing
 * here can affect price, cost, stock, or publishing.
 */
export function ProductColorImageManager({ productId, colors, images: initialImages, canEdit }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  const [images, setImages] = useState(initialImages);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [uploadFor, setUploadFor] = useState<Card | null>(null);
  const [removeFor, setRemoveFor] = useState<Card | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);

  useEffect(() => {
    if (notice?.tone !== "success") return;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  const cards = buildColorImageCards(colors, images);

  function clearSelection() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function closeDialogs() {
    clearSelection();
    setDialogError(null);
    setUploadFor(null);
    setRemoveFor(null);
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setDialogError(null);
    clearSelection();
    if (!file) return;

    if (!ACCEPT_MIME.includes(file.type)) {
      setDialogError("Please upload a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setDialogError(
        `Image is too large. Please upload an image under ${MAX_SIZE_MB} MB. Selected file is ${(file.size / 1024 / 1024).toFixed(1)} MB.`,
      );
      return;
    }
    if (file.size === 0) {
      setDialogError("The selected file is empty.");
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function applyResult(nextImages: ProductImageRow[] | undefined, message: string) {
    if (nextImages) setImages(nextImages);
    setNotice({ tone: "success", text: message });
    router.refresh();
  }

  function handleUpload() {
    if (!uploadFor || !selectedFile || isPending) return;
    const card = uploadFor;
    const file = selectedFile;
    setDialogError(null);

    startTransition(async () => {
      const formData = new FormData();
      formData.append("file", file);
      const result = await uploadProductImageAction(productId, formData, card.color);

      // On failure the dialog stays open with the chosen photo, so staff can just retry.
      if (!result.ok) {
        setDialogError(result.error ?? UPLOAD_ERROR);
        return;
      }

      closeDialogs();
      applyResult(
        result.images,
        `${photoName(card)} photo ${card.image ? "updated" : "uploaded"} successfully.`,
      );
    });
  }

  function handleRemove() {
    if (!removeFor || isPending) return;
    const card = removeFor;
    setDialogError(null);

    startTransition(async () => {
      const result = await removeProductImageAction(productId, card.color);

      if (!result.ok) {
        setDialogError(result.error ?? REMOVE_ERROR);
        return;
      }

      closeDialogs();
      applyResult(result.images, `${photoName(card)} photo removed successfully.`);
    });
  }

  function handleSetCover(card: Card) {
    if (!card.image || isPending) return;
    const imageId = card.image.id;

    startTransition(async () => {
      const result = await setProductCoverImageAction(productId, imageId);

      if (!result.ok) {
        setNotice({ tone: "error", text: result.error ?? COVER_ERROR });
        return;
      }

      applyResult(result.images, "Cover photo changed successfully.");
    });
  }

  return (
    <div className="space-y-3">
      {notice && (
        <p
          role="status"
          className={
            notice.tone === "success"
              ? "flex items-center gap-1.5 rounded-md border border-musiva-sage/30 bg-musiva-sage/10 px-3 py-2 text-sm text-musiva-sage"
              : "rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          }
        >
          {notice.tone === "success" && <CheckCircle2 aria-hidden className="h-4 w-4 shrink-0" />}
          {notice.text}
        </p>
      )}

      {cards.length === 0 ? (
        <p className="rounded-lg border border-dashed border-musiva-border p-6 text-center text-sm text-muted-foreground">
          Add a color to this product to add its photo.
        </p>
      ) : (
        <div className="grid max-w-5xl grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {cards.map((card) => (
            <article
              key={card.key}
              className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-musiva-border bg-white"
            >
              <div className="relative aspect-[4/5] bg-musiva-blush/30">
                {card.image ? (
                  <CardPhoto key={card.image.url} alt={`${card.label} photo`} url={card.image.url} />
                ) : canEdit ? (
                  <button
                    className="flex h-full w-full flex-col items-center justify-center gap-2 text-musiva-plum transition-colors hover:bg-musiva-blush/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    type="button"
                    onClick={() => setUploadFor(card)}
                  >
                    <ImagePlus aria-hidden className="h-7 w-7" />
                    <span className="text-sm font-medium">Add photo</span>
                  </button>
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <ImageOff aria-hidden className="h-7 w-7 opacity-50" />
                  </div>
                )}
                {card.isCover && (
                  <Badge className="absolute left-2 top-2 gap-1 text-[11px] shadow-sm">
                    <Star aria-hidden className="h-3 w-3 fill-current" />
                    Cover photo
                  </Badge>
                )}
              </div>

              <div className="flex flex-1 flex-col gap-2 p-2.5">
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold text-musiva-plum">{card.label}</p>
                  <p className="text-xs text-muted-foreground">{statusText(card)}</p>
                </div>

                {canEdit && card.image && (
                  <div className="mt-auto grid gap-1.5">
                    {!card.isCover && (
                      <Button
                        disabled={isPending}
                        size="sm"
                        type="button"
                        variant="outline"
                        onClick={() => handleSetCover(card)}
                      >
                        Set as cover
                      </Button>
                    )}
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      <Button
                        className="px-2 text-xs"
                        disabled={isPending}
                        size="sm"
                        type="button"
                        variant="outline"
                        onClick={() => setUploadFor(card)}
                      >
                        Change photo
                      </Button>
                      <Button
                        className="px-2 text-xs text-destructive hover:text-destructive"
                        disabled={isPending}
                        size="sm"
                        type="button"
                        variant="outline"
                        onClick={() => setRemoveFor(card)}
                      >
                        Remove photo
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Upload / replace: nothing is saved until staff confirm the preview. */}
      <Dialog open={uploadFor !== null} onOpenChange={(open) => !open && !isPending && closeDialogs()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {uploadFor ? `${uploadFor.image ? "Change" : "Add"} ${uploadFor.label} photo` : "Photo"}
            </DialogTitle>
            <DialogDescription>All sizes in this color will use this photo.</DialogDescription>
          </DialogHeader>

          {previewUrl ? (
            <div className="relative mx-auto aspect-[4/5] w-44 overflow-hidden rounded-lg border border-musiva-border bg-musiva-blush/20">
              <Image alt="Selected photo preview" className="object-cover object-top" fill sizes="176px" src={previewUrl} />
              <button
                aria-label="Choose a different photo"
                className="absolute right-1 top-1 rounded-full bg-white p-1 shadow hover:bg-red-50"
                disabled={isPending}
                type="button"
                onClick={clearSelection}
              >
                <X aria-hidden className="h-4 w-4 text-destructive" />
              </button>
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed border-musiva-border bg-musiva-blush/20 px-4 py-10 text-center transition-colors hover:border-musiva-plum/40 hover:bg-musiva-blush/40">
              <Upload aria-hidden className="h-8 w-8 text-muted-foreground/50" />
              <span className="text-sm font-medium text-musiva-plum">Choose photo</span>
              <span className="text-xs text-muted-foreground">
                JPEG · PNG · WebP · max {MAX_SIZE_MB} MB · 4:5 portrait recommended
              </span>
              <input
                ref={fileInputRef}
                accept={ACCEPT}
                className="sr-only"
                type="file"
                onChange={handleFileChange}
              />
            </label>
          )}

          {dialogError && <p className="text-sm text-destructive">{dialogError}</p>}

          <DialogFooter>
            <Button disabled={isPending} type="button" variant="outline" onClick={closeDialogs}>
              Cancel
            </Button>
            <Button disabled={!selectedFile || isPending} type="button" onClick={handleUpload}>
              {isPending ? (
                <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload aria-hidden className="mr-2 h-4 w-4" />
              )}
              {isPending ? "Uploading..." : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={removeFor !== null} onOpenChange={(open) => !open && !isPending && closeDialogs()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{removeFor ? `Remove ${removeFor.label} photo?` : "Remove photo?"}</DialogTitle>
            <DialogDescription>
              Only this photo is removed.
              {removeFor?.isCover ? " It is the cover photo, so another photo will become the cover." : ""}
            </DialogDescription>
          </DialogHeader>

          {dialogError && <p className="text-sm text-destructive">{dialogError}</p>}

          <DialogFooter>
            <Button disabled={isPending} type="button" variant="outline" onClick={closeDialogs}>
              Cancel
            </Button>
            <Button disabled={isPending} type="button" variant="destructive" onClick={handleRemove}>
              {isPending ? (
                <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 aria-hidden className="mr-2 h-4 w-4" />
              )}
              Remove photo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
