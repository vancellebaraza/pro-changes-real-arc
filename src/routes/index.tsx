import { createFileRoute, Link } from "@tanstack/react-router";
import { SERVICES } from "@/lib/services";
import { Logo } from "@/components/Logo";
import { ArrowRight, ShieldCheck, ClipboardList, BarChart3 } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FusionPro — RealArc Estates Operations" },
      { name: "description", content: "Property service operations for RealArc Estates: electrical, plumbing, landscaping, painting, property management, tank cleaning." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 h-16">
          <Logo className="h-9 w-auto" />
          <nav className="flex items-center gap-6 text-sm">
            <a href="#services" className="text-muted-foreground hover:text-foreground transition">Services</a>
            <a href="#about" className="text-muted-foreground hover:text-foreground transition">About</a>
            <Link to="/auth" className="inline-flex items-center gap-1 rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium hover:opacity-90 transition">
              Sign in <ArrowRight className="h-4 w-4" />
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 pt-24 pb-20 fade-in">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">RealArc Estates · Operations</p>
        <h1 className="mt-4 text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05] max-w-3xl">
          One system for every property service request, inspection, and report.
        </h1>
        <p className="mt-6 max-w-2xl text-base md:text-lg text-muted-foreground leading-relaxed">
          FusionPro coordinates clients, engineers, and admins across electrical, plumbing,
          landscaping, painting, property management, and tank cleaning — from intake to completion.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link to="/auth" className="inline-flex items-center gap-2 rounded-md bg-foreground text-background px-5 py-3 text-sm font-medium hover:opacity-90 transition">
            Get started <ArrowRight className="h-4 w-4" />
          </Link>
          <a href="#services" className="inline-flex items-center rounded-md border border-border bg-background px-5 py-3 text-sm font-medium hover:bg-accent transition">
            View services
          </a>
        </div>
      </section>

      <section id="services" className="border-t bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="flex items-end justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">Services</h2>
              <p className="mt-2 text-muted-foreground">End-to-end coverage across property operations.</p>
            </div>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((s) => (
              <div key={s.key} className="group rounded-xl border bg-card p-6 transition hover:border-foreground/30 hover:-translate-y-0.5">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-md bg-foreground/5">
                    <s.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-medium">{s.label}</h3>
                </div>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="about" className="border-t">
        <div className="mx-auto max-w-6xl px-6 py-20 grid md:grid-cols-3 gap-10">
          <div className="md:col-span-1">
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">About</h2>
            <p className="mt-3 text-muted-foreground">Built for RealArc Estates' multi-trade operations team.</p>
          </div>
          <div className="md:col-span-2 grid sm:grid-cols-3 gap-6">
            {[
              { icon: ClipboardList, t: "Structured intake", d: "Clients submit requests with details and images. Engineers receive and inspect." },
              { icon: ShieldCheck, t: "Quote & approve", d: "Excel-style quotation tables, client approval, admin scheduling." },
              { icon: BarChart3, t: "Track & report", d: "Progress stages, quoted vs actual costs, PDF & CSV exports." },
            ].map((x) => (
              <div key={x.t} className="rounded-xl border bg-card p-5">
                <x.icon className="h-5 w-5" />
                <h3 className="mt-3 font-medium">{x.t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{x.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-6 py-8 flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-3"><Logo className="h-6 w-auto" /><span>© {new Date().getFullYear()} RealArc Estates</span></div>
          <Link to="/auth" className="hover:text-foreground transition">Sign in</Link>
        </div>
      </footer>
    </div>
  );
}
