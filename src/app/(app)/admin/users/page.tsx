import { UsersManager } from "@/components/admin/users-manager";

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Users</h1>
      <p className="text-sm text-zinc-500">Only emails on this list can sign in.</p>
      <UsersManager />
    </div>
  );
}
