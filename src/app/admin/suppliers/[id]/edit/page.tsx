import { notFound } from "next/navigation";
import { SupplierForm } from "@/components/suppliers/supplier-form";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { BackLink } from "@/components/layout/back-link";
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
        <Breadcrumb
          segments={[
            { label: "Management" },
            { label: "Suppliers", href: "/admin/suppliers" },
            { label: supplier.supplier_name, href: `/admin/suppliers/${supplier.id}` },
            { label: "Edit" },
          ]}
        />
        <div className="mt-2">
          <BackLink href={`/admin/suppliers/${supplier.id}`} label="Back to supplier" />
        </div>
        <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">Edit supplier</h1>
        <p className="mt-2 text-sm text-muted-foreground">Update contact and sourcing details.</p>
      </header>
      <SupplierForm supplier={supplier} />
    </div>
  );
}
