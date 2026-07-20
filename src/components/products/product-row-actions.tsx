"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Archive, Image as ImageIcon, MoreHorizontal, PackagePlus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { QuickAddStockDialog } from "@/components/products/quick-add-stock-dialog";
import { ProductArchiveDialog } from "@/components/products/product-archive-dialog";
import { ProductRestoreDialog } from "@/components/products/product-restore-dialog";
import { ProductDeleteDialog } from "@/components/products/product-delete-dialog";
import { ProductCostDialog } from "@/components/products/product-cost-dialog";
import type { StaffRole } from "@/lib/constants";
import { canArchiveProducts, canDeleteProducts } from "@/lib/auth/permissions";

type VariantQuick = { id: string; color: string; size: string; stock_quantity: number };

type VariantCostRow = {
  id: string;
  color: string;
  size: string;
  stockQuantity: number;
  buyingPriceInr: number | null;
  exchangeRateToBhd: number | null;
  convertedUnitCostBhd: number | null;
  additionalLandedCostBhd: number | null;
  finalUnitCostBhd: number | null;
  sellingPriceBhd: number;
};

type CostSummary = {
  validCostCount: number;
  missingCostCount: number;
  totalBuyingValueInr: number;
  totalFinalCostBhd: number;
  totalSellingValueBhd: number;
  variants: VariantCostRow[];
};

type Props = {
  productId: string;
  productName: string;
  productStatus: string;
  variantsQuick: VariantQuick[];
  userRole: StaffRole | null;
  /** Only passed when the viewer's role is permitted (canViewBuyingCost) — omitted
   *  entirely otherwise so cost data never reaches the client for unauthorized roles. */
  costView?: {
    totalStock: number;
    costSummary: CostSummary;
    /** Owner/manager/accountant only — gates selling value/profit/margin inside the dialog. */
    showProfit: boolean;
  };
};

type Dialog = "archive" | "restore" | "delete" | null;

export function ProductRowActions({
  productId,
  productName,
  productStatus,
  variantsQuick,
  userRole,
  costView,
}: Props) {
  const router = useRouter();
  const [openDialog, setOpenDialog] = useState<Dialog>(null);

  const isArchived = productStatus === "archived";
  const canArchive = canArchiveProducts(userRole);
  const canDelete = canDeleteProducts(userRole);

  function handleSuccess() {
    setOpenDialog(null);
    router.refresh();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={`Actions for ${productName}`}
            className="h-8 w-8"
            size="icon"
            variant="ghost"
          >
            <MoreHorizontal aria-hidden className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem asChild>
            <Link href={`/admin/products/${productId}`}>View product</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/admin/products/${productId}/edit`}>Edit product</Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Add stock — disabled for archived products */}
          <DropdownMenuItem asChild={false} className="p-0">
            {variantsQuick.length > 0 && !isArchived ? (
              <QuickAddStockDialog productName={productName} variants={variantsQuick} />
            ) : (
              <span className="flex w-full cursor-not-allowed items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
                <PackagePlus aria-hidden className="h-4 w-4" />
                Add stock
              </span>
            )}
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <Link href={`/admin/products/${productId}`}>
              <ImageIcon aria-hidden className="mr-2 h-4 w-4" />
              Change image
            </Link>
          </DropdownMenuItem>

          {costView && (
            <DropdownMenuItem asChild={false} className="p-0">
              <ProductCostDialog
                productName={productName}
                totalStock={costView.totalStock}
                costSummary={costView.costSummary}
                showProfit={costView.showProfit}
              />
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          {/* Archive / Restore */}
          {canArchive && !isArchived && (
            <DropdownMenuItem
              className="text-warning focus:text-warning"
              onSelect={() => setOpenDialog("archive")}
            >
              <Archive aria-hidden className="mr-2 h-4 w-4" />
              Archive product
            </DropdownMenuItem>
          )}
          {canArchive && isArchived && (
            <DropdownMenuItem onSelect={() => setOpenDialog("restore")}>
              <RefreshCw aria-hidden className="mr-2 h-4 w-4" />
              Restore product
            </DropdownMenuItem>
          )}

          {/* Permanent delete — owner/manager only */}
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => setOpenDialog("delete")}
              >
                <Trash2 aria-hidden className="mr-2 h-4 w-4" />
                Delete permanently
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialogs — only render when relevant */}
      {canArchive && (
        <>
          <ProductArchiveDialog
            open={openDialog === "archive"}
            productId={productId}
            productName={productName}
            onClose={() => setOpenDialog(null)}
            onSuccess={handleSuccess}
          />
          <ProductRestoreDialog
            open={openDialog === "restore"}
            productId={productId}
            productName={productName}
            onClose={() => setOpenDialog(null)}
            onSuccess={handleSuccess}
          />
        </>
      )}
      {canDelete && (
        <ProductDeleteDialog
          open={openDialog === "delete"}
          productId={productId}
          productName={productName}
          onClose={() => setOpenDialog(null)}
        />
      )}
    </>
  );
}
