"use client";

interface PlannedFile {
  path: string;
  action: "create" | "modify" | "delete";
  description: string;
}

interface PlannedTest {
  description: string;
  type: "unit" | "integration" | "e2e";
}

interface Plan {
  summary?: string;
  approach?: string;
  files?: PlannedFile[];
  tests?: PlannedTest[];
  dependencies?: string[];
  risks?: string[];
  estimatedComplexity?: string;
}

const ACTION_STYLES: Record<string, string> = {
  create: "bg-emerald-500/10 text-emerald-400 ring-1 ring-inset ring-emerald-500/20",
  modify: "bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] ring-1 ring-inset ring-[var(--accent-blue)]/20",
  delete: "bg-red-500/10 text-red-400 ring-1 ring-inset ring-red-500/20",
};

export function AgentPlanViewer({ plan }: { plan: Plan | null }) {
  if (!plan) {
    return (
      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 text-center text-sm text-[var(--text-quaternary)]">
        No plan generated yet
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
      {plan.summary && (
        <div>
          <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--text-quaternary)]">Summary</h3>
          <p className="mt-1.5 text-sm text-[var(--text-secondary)]">{plan.summary}</p>
        </div>
      )}

      {plan.approach && (
        <div>
          <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--text-quaternary)]">Approach</h3>
          <p className="mt-1.5 text-sm text-[var(--text-secondary)]">{plan.approach}</p>
        </div>
      )}

      {plan.estimatedComplexity && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-quaternary)]">Complexity</span>
          <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${
            plan.estimatedComplexity === "high"
              ? "bg-red-500/10 text-red-400"
              : plan.estimatedComplexity === "medium"
                ? "bg-amber-500/10 text-amber-400"
                : "bg-emerald-500/10 text-emerald-400"
          }`}>
            {plan.estimatedComplexity}
          </span>
        </div>
      )}

      {plan.files && plan.files.length > 0 && (
        <div>
          <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--text-quaternary)]">
            Files ({plan.files.length})
          </h3>
          <ul className="mt-2 space-y-1.5">
            {plan.files.map((f, i) => (
              <li key={i} className="flex items-center gap-2 text-xs">
                <span className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${ACTION_STYLES[f.action] ?? ""}`}>
                  {f.action}
                </span>
                <span className="font-mono text-[var(--text-secondary)]">{f.path}</span>
                <span className="text-[var(--text-quaternary)]">— {f.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {plan.tests && plan.tests.length > 0 && (
        <div>
          <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--text-quaternary)]">
            Tests ({plan.tests.length})
          </h3>
          <ul className="mt-2 space-y-1.5">
            {plan.tests.map((t, i) => (
              <li key={i} className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <span className="rounded-md bg-[var(--bg-elevated)] px-1.5 py-0.5 text-xs text-[var(--text-quaternary)]">{t.type}</span>
                {t.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      {plan.dependencies && plan.dependencies.length > 0 && (
        <div>
          <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--text-quaternary)]">Dependencies</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {plan.dependencies.map((d, i) => (
              <span key={i} className="rounded-md bg-[var(--bg-elevated)] px-2 py-0.5 text-xs text-[var(--text-tertiary)]">
                {d}
              </span>
            ))}
          </div>
        </div>
      )}

      {plan.risks && plan.risks.length > 0 && (
        <div>
          <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--text-quaternary)]">Risks</h3>
          <ul className="mt-2 space-y-1 text-xs text-amber-400/90">
            {plan.risks.map((r, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-0.5 text-amber-500/60">!</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
