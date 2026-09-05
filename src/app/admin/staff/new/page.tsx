import { StaffForm } from "@/components/staff/staff-form";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { BackLink } from "@/components/layout/back-link";

export default function NewStaffPage() {
  return (
    <div className="space-y-6">
      <header>
        <Breadcrumb
          segments={[
            { label: "Management" },
            { label: "Staff & Roles", href: "/admin/staff" },
            { label: "New Staff" },
          ]}
        />
        <div className="mt-2">
          <BackLink href="/admin/staff" label="Back to staff" />
        </div>
        <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">New staff user</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Create a Supabase Auth user and matching staff profile.
        </p>
      </header>
      <StaffForm />
    </div>
  );
}
