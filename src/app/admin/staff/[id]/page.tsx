import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getStaffProfile } from "@/lib/services/staff.service";
import { formatDateTime } from "@/lib/formatters/date";
import { titleize } from "@/lib/formatters/labels";

type StaffDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function StaffDetailPage({ params }: StaffDetailPageProps) {
  const { id } = await params;
  const profile = await getStaffProfile(id);

  if (!profile) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">Staff</p>
        <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">{profile.full_name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{profile.email}</p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Role</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium text-musiva-plum">{titleize(profile.role)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={profile.status === "active" ? "success" : "secondary"}>
              {titleize(profile.status)}
            </Badge>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Created</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium text-musiva-plum">{formatDateTime(profile.created_at)}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Contact</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm md:grid-cols-2">
          <div>
            <p className="text-muted-foreground">Email</p>
            <p className="mt-1 font-medium text-musiva-plum">{profile.email}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Phone</p>
            <p className="mt-1 font-medium text-musiva-plum">{profile.phone ?? "-"}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
