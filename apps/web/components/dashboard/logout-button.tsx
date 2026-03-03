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
      className="rounded-md border px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
      onClick={handleLogout}
      type="button"
    >
      Sign out
    </button>
  );
}
