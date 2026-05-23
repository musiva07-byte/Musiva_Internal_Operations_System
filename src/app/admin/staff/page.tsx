import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/products/pagination";
import { STAFF_ROLES } from "@/lib/constants";
import { listStaff } from "@/lib/services/staff.service";
import { formatDate } from "@/lib/formatters/date";
import { titleize } from "@/lib/formatters/labels";

type StaffPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const roleOptions = [
  STAFF_ROLES.owner,
  STAFF_ROLES.manager,
  STAFF_ROLES.salesStaff,
  STAFF_ROLES.inventoryStaff,
  STAFF_ROLES.accountant,
  STAFF_ROLES.deliveryCoordinator,
];

function getParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function StaffPage({ searchParams }: StaffPageProps) {
  const params = await searchParams;
  const q = getParam(params, "q") ?? "";
  const role = getParam(params, "role") ?? "all";
  const page = Number(getParam(params, "page") ?? 1);
  const staff = await listStaff({ q, role, page });

  const hrefForPage = (nextPage: number) => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (role !== "all") next.set("role", role);
    next.set("page", String(nextPage));
    return `/admin/staff?${next.toString()}`;
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">Staff</p>
          <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">Staff & roles</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage internal staff profiles and role assignments.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/staff/new">
            <Plus aria-hidden className="mr-2 h-4 w-4" />
            New staff
          </Link>
        </Button>
      </header>

      <Card className="shadow-soft">
        <CardContent className="pt-6">
          <form className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
            <div className="relative">
              <Search aria-hidden className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-10" defaultValue={q} name="q" placeholder="Search name, email, phone" />
            </div>
            <Select defaultValue={role} name="role">
              <option value="all">All roles</option>
              {roleOptions.map((staffRole) => (
                <option key={staffRole} value={staffRole}>
                  {titleize(staffRole)}
                </option>
              ))}
            </Select>
            <Button type="submit" variant="outline">
              Filter
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Staff member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {staff.data.length === 0 ? (
              <TableRow>
                <TableCell className="h-28 text-center text-muted-foreground" colSpan={5}>
                  No staff profiles found.
                </TableCell>
              </TableRow>
            ) : (
              staff.data.map((profile) => (
                <TableRow key={profile.id}>
                  <TableCell>
                    <Link className="font-medium text-musiva-plum hover:underline" href={`/admin/staff/${profile.id}`}>
                      {profile.full_name}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">{profile.email}</p>
                  </TableCell>
                  <TableCell>{titleize(profile.role)}</TableCell>
                  <TableCell>
                    <Badge variant={profile.status === "active" ? "success" : "secondary"}>
                      {titleize(profile.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>{profile.phone ?? "-"}</TableCell>
                  <TableCell>{formatDate(profile.created_at)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Pagination href={hrefForPage} page={staff.page} pageCount={staff.pageCount} />
    </div>
  );
}
