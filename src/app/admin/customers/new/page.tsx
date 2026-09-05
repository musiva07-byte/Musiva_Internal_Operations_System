import { CustomerForm } from "@/components/customers/customer-form";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { BackLink } from "@/components/layout/back-link";

export default function NewCustomerPage() {
  return (
    <div className="space-y-6">
      <header>
        <Breadcrumb segments={[{ label: "Customers", href: "/admin/customers" }, { label: "New customer" }]} />
        <div className="mt-2">
          <BackLink href="/admin/customers" label="Back to customers" />
        </div>
        <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">New customer</h1>
        <p className="mt-2 text-sm text-muted-foreground">Add customer contact and Bahrain delivery details.</p>
      </header>
      <CustomerForm />
    </div>
  );
}
