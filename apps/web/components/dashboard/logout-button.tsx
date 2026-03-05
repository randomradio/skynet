"use client";

import { useRouter } from "next/navigation";

export function LogoutButton(): React.ReactElement {
  const router = useRouter();

  async function handleLogout(): Promise<void> {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    router.push("/");
    router.refresh();
  }

  return (
    <button
      className="rounded-md border border-[var(--border-default)] px-3 py-1.5 text-xs font-medium text-[var(--text-tertiary)] transition-all hover:text-[var(--text-primary)] hover:border-[var(--border-bright)] hover:bg-[var(--bg-hover)]"
      onClick={handleLogout}
      type="button"
    >
      Sign out
    </button>
  );
}
