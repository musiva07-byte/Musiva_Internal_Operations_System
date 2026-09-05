import { SupplierForm } from "@/components/suppliers/supplier-form";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { BackLink } from "@/components/layout/back-link";

export default function NewSupplierPage() {
  return (
    <div className="space-y-6">
      <header>
        <Breadcrumb
          segments={[
            { label: "Management" },
            { label: "Suppliers", href: "/admin/suppliers" },
            { label: "New Supplier" },
          ]}
        />
        <div className="mt-2">
          <BackLink href="/admin/suppliers" label="Back to suppliers" />
        </div>
        <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">New supplier</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Add supplier contact details before creating purchase orders.
        </p>
      </header>
      <SupplierForm />
    </div>
  );
}
