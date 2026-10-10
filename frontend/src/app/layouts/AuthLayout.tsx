import { FileCheck2, Receipt, ShieldCheck, Zap } from 'lucide-react';
import { Outlet } from 'react-router-dom';
import { ThemeToggle } from '../../shared/components/ui';

const POINTS = [
  { icon: Zap, text: 'Invoice in four steps with automatic taxes' },
  { icon: FileCheck2, text: 'Issued invoices are locked and auditable' },
  { icon: ShieldCheck, text: 'Role-based access for admins, billers and customers' },
];

export function AuthLayout() {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-brand p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden="true" className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-2xl" />
        <div aria-hidden="true" className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-control bg-white/15 ring-1 ring-white/25">
            <Receipt size={20} aria-hidden="true" />
          </span>
          <span className="text-base font-semibold tracking-tight">Northwind Billing</span>
        </div>
        <div className="relative max-w-md">
          <h2 className="text-display font-semibold leading-tight tracking-tight">Billing that stays out of your way.</h2>
          <p className="mt-3 text-base text-white/75">Customers, services, taxes and payments in one calm, precise back-office.</p>
          <ul className="mt-8 flex flex-col gap-4">
            {POINTS.map((p) => (
              <li key={p.text} className="flex items-center gap-3 text-sm text-white/90">
                <span className="flex h-8 w-8 items-center justify-center rounded-control bg-white/12 ring-1 ring-white/20">
                  <p.icon size={16} aria-hidden="true" />
                </span>
                {p.text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/60">Prototype · demo data only</p>
      </aside>

      <main className="relative flex flex-col items-center justify-center px-4 py-10">
        <ThemeToggle className="absolute right-4 top-4" />
        <div className="mb-8 flex items-center gap-3 lg:hidden">
          <span className="flex h-9 w-9 items-center justify-center rounded-control bg-brand text-white">
            <Receipt size={18} aria-hidden="true" />
          </span>
          <span className="text-base font-semibold">Northwind Billing</span>
        </div>
        <div className="w-full max-w-sm rounded-xl border border-line/70 bg-surface p-8 shadow-card">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
