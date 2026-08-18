"use client";

import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { titleize } from "@/lib/formatters/labels";
import type { ProductInput } from "@/lib/validations/product.schema";

/** Snapshot of what was just saved — built by ProductForm from the submitted values (plus,
 *  for an edit, the product's pre-save website status) right after createProductAction /
 *  updateProductAction succeeds. Drives ProductSaveSuccessDialog below so staff get a clear
 *  confirmation of what happened instead of a silent redirect. */
export type SaveSuccessInfo = {
  productId: string;
  productName: string;
  variantCount: number;
  newVariantCount: number;
  startingStock: number;
  onlineStatus: ProductInput["onlineStatus"];
  websiteVisible: boolean;
  websiteStatusChanged: boolean;
  costChanged: boolean;
  hasImages: boolean;
};

const STATUS_VARIANT: Record<ProductInput["onlineStatus"], "success" | "warning" | "secondary"> = {
  published: "success",
  draft: "warning",
  hidden: "secondary",
};

type Props = {
  open: boolean;
  info: SaveSuccessInfo;
  isEditing: boolean;
  onViewProduct: () => void;
  onBackToCatalog: () => void;
  onContinueEditing: () => void;
};

export function ProductSaveSuccessDialog({
  open,
  info,
  isEditing,
  onViewProduct,
  onBackToCatalog,
  onContinueEditing,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onContinueEditing()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-musiva-sage">
            <CheckCircle2 aria-hidden className="h-5 w-5" />
            {isEditing ? "Product updated successfully" : "Product created successfully"}
          </DialogTitle>
          <DialogDescription>{info.productName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">
              {isEditing ? "Variants on this product" : "Variants created"}
            </span>
            <span className="font-medium text-foreground">
              {isEditing ? info.variantCount : info.newVariantCount}
            </span>
          </div>

          {isEditing && info.newVariantCount > 0 ? (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">New variants added</span>
              <span className="font-medium text-foreground">{info.newVariantCount}</span>
            </div>
          ) : null}

          {info.startingStock > 0 ? (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Starting stock created</span>
              <span className="font-medium text-foreground">{info.startingStock} units</span>
            </div>
          ) : null}

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Website status</span>
            <Badge variant={STATUS_VARIANT[info.onlineStatus]}>{titleize(info.onlineStatus)}</Badge>
          </div>

          {info.costChanged ? (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Buying cost</span>
              <span className="font-medium text-foreground">Saved</span>
            </div>
          ) : null}

          {!isEditing && info.hasImages ? (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Image</span>
              <span className="font-medium text-foreground">Saved</span>
            </div>
          ) : null}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          {isEditing ? (
            <Button type="button" variant="outline" onClick={onContinueEditing}>
              Continue editing
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={onBackToCatalog}>
            Back to catalog
          </Button>
          <Button type="button" onClick={onViewProduct}>
            View product
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
