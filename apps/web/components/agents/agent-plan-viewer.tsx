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
  create: "bg-green-100 text-green-800",
  modify: "bg-blue-100 text-blue-800",
  delete: "bg-red-100 text-red-800",
};

export function AgentPlanViewer({ plan }: { plan: Plan | null }) {
  if (!plan) {
    return (
      <div className="rounded-lg border bg-slate-50 p-4 text-center text-sm text-slate-500">
        No plan generated yet
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border bg-white p-4">
      {plan.summary && (
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Summary</h3>
          <p className="mt-1 text-sm text-slate-600">{plan.summary}</p>
        </div>
      )}

      {plan.approach && (
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Approach</h3>
          <p className="mt-1 text-sm text-slate-600">{plan.approach}</p>
        </div>
      )}

      {plan.estimatedComplexity && (
        <div>
          <span className="text-xs text-slate-500">Complexity: </span>
          <span className={`text-xs font-medium ${
            plan.estimatedComplexity === "high"
              ? "text-red-600"
              : plan.estimatedComplexity === "medium"
                ? "text-amber-600"
                : "text-green-600"
          }`}>
            {plan.estimatedComplexity}
          </span>
        </div>
      )}

      {plan.files && plan.files.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Files ({plan.files.length})
          </h3>
          <ul className="mt-1 space-y-1">
            {plan.files.map((f, i) => (
              <li key={i} className="flex items-center gap-2 text-xs">
                <span className={`rounded px-1.5 py-0.5 font-medium ${ACTION_STYLES[f.action] ?? ""}`}>
                  {f.action}
                </span>
                <span className="font-mono text-slate-700">{f.path}</span>
                <span className="text-slate-400">— {f.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {plan.tests && plan.tests.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Tests ({plan.tests.length})
          </h3>
          <ul className="mt-1 space-y-1">
            {plan.tests.map((t, i) => (
              <li key={i} className="text-xs text-slate-600">
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">{t.type}</span>{" "}
                {t.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      {plan.dependencies && plan.dependencies.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Dependencies</h3>
          <div className="mt-1 flex flex-wrap gap-1">
            {plan.dependencies.map((d, i) => (
              <span key={i} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                {d}
              </span>
            ))}
          </div>
        </div>
      )}

      {plan.risks && plan.risks.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Risks</h3>
          <ul className="mt-1 list-inside list-disc text-xs text-amber-700">
            {plan.risks.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
