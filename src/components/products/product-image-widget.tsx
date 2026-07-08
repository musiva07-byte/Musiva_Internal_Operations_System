"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, ImageOff, Loader2, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { uploadProductImageAction, removeProductImageAction } from "@/app/admin/products/image-actions";

const MAX_SIZE_MB = 5;
const MAX_BYTES = MAX_SIZE_MB * 1024 * 1024;
const ACCEPT = ".jpg,.jpeg,.png,.webp";
const ACCEPT_MIME = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

type DialogMode = "upload" | "manage" | null;

type Props = {
  productId: string;
  /** Current image URL, null when no image exists yet. */
  currentUrl: string | null;
  /** Whether the logged-in user may edit images. */
  canEdit: boolean;
};

export function ProductImageWidget({ productId, currentUrl, canEdit }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<DialogMode>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Optimistic image URL — updated immediately after successful upload/remove
  const [optimisticUrl, setOptimisticUrl] = useState<string | null>(currentUrl);

  // Keep optimistic URL in sync when parent re-renders (router.refresh)
  if (optimisticUrl !== currentUrl && !isPending && previewUrl === null) {
    setOptimisticUrl(currentUrl);
  }

  const hasImage = Boolean(optimisticUrl);

  // ── File selection ─────────────────────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setFileError(null);

    if (!file) {
      clearSelection();
      return;
    }

    if (!ACCEPT_MIME.includes(file.type)) {
      setFileError("Only JPEG, PNG, and WebP images are accepted.");
      clearSelection();
      return;
    }

    if (file.size > MAX_BYTES) {
      setFileError(`Image must be ${MAX_SIZE_MB} MB or smaller. Selected file is ${(file.size / 1024 / 1024).toFixed(1)} MB.`);
      clearSelection();
      return;
    }

    if (file.size === 0) {
      setFileError("The selected file is empty.");
      clearSelection();
      return;
    }

    // Revoke previous preview
    if (previewUrl) URL.revokeObjectURL(previewUrl);

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function clearSelection() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ── Upload ─────────────────────────────────────────────────────────────────────

  function handleUpload() {
    if (!selectedFile) return;
    setActionError(null);

    startTransition(async () => {
      const fd = new FormData();
      fd.append("file", selectedFile);
      const result = await uploadProductImageAction(productId, fd);

      if (!result.ok || !result.url) {
        setActionError(result.error ?? "Upload failed. Please try again.");
        return;
      }

      // Optimistic update
      setOptimisticUrl(result.url);
      close();
      router.refresh();
    });
  }

  // ── Remove ─────────────────────────────────────────────────────────────────────

  function handleRemove() {
    if (!confirmRemove) {
      setConfirmRemove(true);
      return;
    }

    setActionError(null);
    startTransition(async () => {
      const result = await removeProductImageAction(productId);

      if (!result.ok) {
        setActionError(result.error ?? "Remove failed. Please try again.");
        setConfirmRemove(false);
        return;
      }

      setOptimisticUrl(null);
      close();
      router.refresh();
    });
  }

  // ── Dialog open/close ──────────────────────────────────────────────────────────

  function open(m: DialogMode) {
    clearSelection();
    setActionError(null);
    setConfirmRemove(false);
    setMode(m);
  }

  function close() {
    clearSelection();
    setActionError(null);
    setConfirmRemove(false);
    setMode(null);
  }

  // ── Thumbnail / placeholder ────────────────────────────────────────────────────

  const thumbnailContent = hasImage ? (
    <div className="relative h-full w-full overflow-hidden rounded-lg">
      <Image
        alt="Product image"
        className="object-cover object-top"
        fill
        sizes="(max-width: 640px) 160px, 200px"
        src={optimisticUrl!}
      />
      {canEdit && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/25 group-hover:opacity-100 rounded-lg">
          <span className="flex items-center gap-1.5 rounded-md bg-white/90 px-2.5 py-1.5 text-xs font-medium text-musiva-plum shadow-sm">
            <Camera aria-hidden className="h-3.5 w-3.5" />
            Change image
          </span>
        </div>
      )}
    </div>
  ) : (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-musiva-border bg-musiva-blush/30 text-muted-foreground transition-colors group-hover:border-musiva-plum/40 group-hover:bg-musiva-blush/50">
      <ImageOff aria-hidden className="h-7 w-7 text-muted-foreground/50" />
      {canEdit && (
        <span className="text-xs font-medium text-musiva-plum/70">Add image</span>
      )}
    </div>
  );

  const thumbnailWrapper = canEdit ? (
    <button
      aria-label={hasImage ? "Change product image" : "Add product image"}
      className="group relative h-40 w-32 shrink-0 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-musiva-plum focus-visible:ring-offset-2 rounded-lg"
      type="button"
      onClick={() => open(hasImage ? "manage" : "upload")}
    >
      {thumbnailContent}
    </button>
  ) : (
    <div className="relative h-40 w-32 shrink-0 rounded-lg">
      {thumbnailContent}
    </div>
  );

  // ── Upload dialog (add first image or replace) ─────────────────────────────────

  const uploadDialog = (
    <Dialog open={mode === "upload"} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Product image</DialogTitle>
        </DialogHeader>

        {/* Preview or file picker */}
        {previewUrl ? (
          <div className="relative">
            <div className="relative mx-auto h-52 w-40 overflow-hidden rounded-lg border border-musiva-border bg-musiva-blush/20">
              <Image
                alt="Preview"
                className="object-cover object-top"
                fill
                sizes="160px"
                src={previewUrl}
              />
            </div>
            <button
              aria-label="Remove selected image"
              className="absolute right-0 top-0 rounded-full bg-white p-1 shadow hover:bg-red-50"
              type="button"
              onClick={clearSelection}
            >
              <X aria-hidden className="h-4 w-4 text-destructive" />
            </button>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {selectedFile?.name}
            </p>
          </div>
        ) : (
          <label className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed border-musiva-border bg-musiva-blush/20 px-4 py-10 text-center transition-colors hover:border-musiva-plum/40 hover:bg-musiva-blush/40">
            <Upload aria-hidden className="h-8 w-8 text-muted-foreground/50" />
            <span className="text-sm font-medium text-musiva-plum">Choose image</span>
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

        {fileError && (
          <p className="text-sm text-destructive">{fileError}</p>
        )}
        {actionError && (
          <p className="text-sm text-destructive">{actionError}</p>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" onClick={close} disabled={isPending}>
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={handleUpload} disabled={!selectedFile || isPending}>
            {isPending ? (
              <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload aria-hidden className="mr-2 h-4 w-4" />
            )}
            Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // ── Manage dialog (replace or remove existing image) ──────────────────────────

  const manageDialog = (
    <Dialog open={mode === "manage"} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Product image</DialogTitle>
        </DialogHeader>

        {/* Current or new preview */}
        <div className="relative mx-auto h-52 w-40 overflow-hidden rounded-lg border border-musiva-border bg-musiva-blush/20">
          <Image
            alt="Product image"
            className="object-cover object-top"
            fill
            sizes="160px"
            src={previewUrl ?? optimisticUrl ?? ""}
          />
        </div>

        {/* File selection for replace */}
        {previewUrl ? (
          <div className="flex items-center justify-between rounded-md border border-musiva-border bg-musiva-ivory px-3 py-2 text-sm">
            <span className="truncate text-muted-foreground">{selectedFile?.name}</span>
            <button
              aria-label="Deselect"
              className="ml-2 shrink-0 rounded-full p-0.5 hover:bg-red-50"
              type="button"
              onClick={clearSelection}
            >
              <X aria-hidden className="h-4 w-4 text-destructive" />
            </button>
          </div>
        ) : (
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-musiva-border bg-musiva-ivory px-3 py-2 text-sm font-medium text-musiva-plum transition-colors hover:bg-musiva-blush/30">
            <Upload aria-hidden className="h-4 w-4" />
            Change image
            <input
              ref={fileInputRef}
              accept={ACCEPT}
              className="sr-only"
              type="file"
              onChange={handleFileChange}
            />
          </label>
        )}

        {fileError && <p className="text-sm text-destructive">{fileError}</p>}
        {actionError && <p className="text-sm text-destructive">{actionError}</p>}

        {/* Confirm remove */}
        {confirmRemove && (
          <p className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            Remove this image? This cannot be undone.
          </p>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={handleRemove}
            disabled={isPending}
          >
            {isPending && confirmRemove ? (
              <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 aria-hidden className="mr-2 h-4 w-4" />
            )}
            {confirmRemove ? "Confirm remove" : "Remove image"}
          </Button>

          <div className="flex gap-2 sm:ml-auto">
            <Button variant="outline" size="sm" onClick={close} disabled={isPending}>
              Cancel
            </Button>
            {previewUrl && (
              <Button size="sm" onClick={handleUpload} disabled={isPending}>
                {isPending && !confirmRemove ? (
                  <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload aria-hidden className="mr-2 h-4 w-4" />
                )}
                Upload
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <>
      {thumbnailWrapper}
      {canEdit && uploadDialog}
      {canEdit && manageDialog}
    </>
  );
}
