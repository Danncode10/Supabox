"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SignOutButton({ className, compact = false }: { className?: string; compact?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button
      variant="ghost"
      size={compact ? "icon-lg" : "lg"}
      className={cn("text-muted-foreground md:h-10", compact && "md:size-10", className)}
      onClick={signOut}
      loading={busy}
      aria-label={compact ? "Sign out" : undefined}
    >
      {!busy && <LogOut aria-hidden />}
      {!compact && "Sign out"}
    </Button>
  );
}
