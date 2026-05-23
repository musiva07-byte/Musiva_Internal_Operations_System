import { notFound } from "next/navigation";
import { CustomerForm } from "@/components/customers/customer-form";
import { getCustomer } from "@/lib/services/customer.service";

type EditCustomerPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditCustomerPage({ params }: EditCustomerPageProps) {
  const { id } = await params;
  const customer = await getCustomer(id);

  if (!customer) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">Customers</p>
        <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">Edit customer</h1>
      </header>
      <CustomerForm customer={customer} />
    </div>
  );
}
