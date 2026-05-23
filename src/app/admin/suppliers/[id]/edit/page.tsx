import { notFound } from "next/navigation";
import { SupplierForm } from "@/components/suppliers/supplier-form";
import { getSupplier } from "@/lib/services/supplier.service";

type EditSupplierPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditSupplierPage({ params }: EditSupplierPageProps) {
  const { id } = await params;
  const supplier = await getSupplier(id);

  if (!supplier) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">Suppliers</p>
        <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">Edit supplier</h1>
        <p className="mt-2 text-sm text-muted-foreground">Update contact and sourcing details.</p>
      </header>
      <SupplierForm supplier={supplier} />
    </div>
  );
}
