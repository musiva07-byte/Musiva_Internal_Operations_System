import { notFound } from "next/navigation";
import { CustomerForm } from "@/components/customers/customer-form";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { BackLink } from "@/components/layout/back-link";
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
        <Breadcrumb
          segments={[
            { label: "Customers", href: "/admin/customers" },
            { label: customer.full_name, href: `/admin/customers/${customer.id}` },
            { label: "Edit" },
          ]}
        />
        <div className="mt-2">
          <BackLink href={`/admin/customers/${customer.id}`} label="Back to customer" />
        </div>
        <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">Edit customer</h1>
      </header>
      <CustomerForm customer={customer} />
    </div>
  );
}
