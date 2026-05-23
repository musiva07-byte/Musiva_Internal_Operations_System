import { CustomerForm } from "@/components/customers/customer-form";

export default function NewCustomerPage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">Customers</p>
        <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">New customer</h1>
        <p className="mt-2 text-sm text-muted-foreground">Add customer contact and Bahrain delivery details.</p>
      </header>
      <CustomerForm />
    </div>
  );
}
