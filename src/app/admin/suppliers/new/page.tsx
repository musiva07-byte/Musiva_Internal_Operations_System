import { SupplierForm } from "@/components/suppliers/supplier-form";

export default function NewSupplierPage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">Suppliers</p>
        <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">New supplier</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Add supplier contact details before creating purchase orders.
        </p>
      </header>
      <SupplierForm />
    </div>
  );
}
