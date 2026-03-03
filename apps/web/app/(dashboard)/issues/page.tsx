export default function IssuesPage(): React.ReactElement {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Issue Management</h1>
      <p className="text-sm text-slate-600">
        Phase 2 starts from this page. List/detail and sync workflows will be
        implemented on top of this shell.
      </p>
      <div className="rounded-lg border bg-white p-4 text-sm text-slate-700 shadow-sm">
        No synced issues yet.
      </div>
    </section>
  );
}
