import { StaffForm } from "@/components/staff/staff-form";

export default function NewStaffPage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">Staff</p>
        <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">New staff user</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Create a Supabase Auth user and matching staff profile.
        </p>
      </header>
      <StaffForm />
    </div>
  );
}
