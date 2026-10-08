import { UsersManager } from "@/components/admin/users-manager";
import { BlurFade } from "@/components/ui/blur-fade";

export default function UsersPage() {
  return (
    <div className="flex flex-col gap-8">
      <BlurFade>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">Only emails on this list can sign in.</p>
      </BlurFade>
      <UsersManager />
    </div>
  );
}
