import { AuthSessionBootstrap } from "@/components/dashboard/auth-session-bootstrap";

const cards = [
  { label: "Open Issues", value: "0" },
  { label: "P0/P1 Issues", value: "0" },
  { label: "Active Agents", value: "0" },
  { label: "Blockers", value: "0" },
];

export default function DashboardPage(): React.ReactElement {
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-slate-600">
          Foundation shell for Phase 1 implementation.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <article
            key={card.label}
            className="rounded-lg border bg-white p-4 shadow-sm"
          >
            <p className="text-sm text-slate-500">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold">{card.value}</p>
          </article>
        ))}
      </div>

      <AuthSessionBootstrap />
    </section>
  );
}
