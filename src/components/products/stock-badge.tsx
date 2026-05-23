import { Badge } from "@/components/ui/badge";

type StockBadgeProps = {
  quantity: number;
  minimumStock: number;
};

export function StockBadge({ quantity, minimumStock }: StockBadgeProps) {
  if (quantity <= 0) {
    return <Badge variant="danger">Out of Stock</Badge>;
  }

  if (quantity <= minimumStock) {
    return <Badge variant="warning">Low Stock</Badge>;
  }

  return <Badge variant="success">In Stock</Badge>;
}
