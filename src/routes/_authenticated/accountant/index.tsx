import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/accountant/")({
  component: AccountantDashboard,
});

function AccountantDashboard() {
  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Accountant Dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          Financial overview and pending operations.
        </p>
      </div>
      
      <div className="rounded-xl border bg-card p-8 text-center mt-10">
        <h3 className="text-lg font-medium text-foreground">Welcome, Accountant.</h3>
        <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
          This workspace is ready for financial workflows, quotation reviews, and invoicing integrations.
        </p>
      </div>
    </div>
  );
}
