import {
  FilePlus2,
  FileText,
  LayoutDashboard,
  ListChecks,
  Package,
  Percent,
  ScrollText,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '../../shared/types';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** match only the exact path (used to keep "Invoices" from lighting up on /invoices/new) */
  end?: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

const DASHBOARD: NavItem = { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard };
const INVOICES: NavItem = { to: '/invoices', label: 'Invoices', icon: FileText, end: true };
const NEW_INVOICE: NavItem = { to: '/invoices/new', label: 'New invoice', icon: FilePlus2 };

export const NAVIGATION: Record<Role, NavSection[]> = {
  ADMIN: [
    { title: 'Overview', items: [DASHBOARD] },
    { title: 'Billing', items: [INVOICES, NEW_INVOICE] },
    {
      title: 'Catalog & people',
      items: [
        { to: '/customers', label: 'Customers', icon: Users },
        { to: '/services', label: 'Services', icon: Package },
        { to: '/features', label: 'Features', icon: ListChecks },
        { to: '/taxes', label: 'Taxes', icon: Percent },
      ],
    },
    {
      title: 'Administration',
      items: [
        { to: '/users', label: 'Users', icon: UserCog },
        { to: '/audit', label: 'Audit log', icon: ScrollText },
      ],
    },
  ],
  BILLER: [
    { title: 'Overview', items: [DASHBOARD] },
    { title: 'Billing', items: [INVOICES, NEW_INVOICE] },
    {
      title: 'Directory',
      items: [
        { to: '/customers', label: 'Customers', icon: Users },
        { to: '/services', label: 'Services', icon: Package },
      ],
    },
  ],
  CUSTOMER: [{ title: 'Billing', items: [{ to: '/my-invoices', label: 'My invoices', icon: FileText }] }],
};

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  invoices: 'Invoices',
  'my-invoices': 'My invoices',
  new: 'New',
  edit: 'Edit',
  receipt: 'Receipt',
  customers: 'Customers',
  services: 'Services',
  features: 'Features',
  taxes: 'Taxes',
  users: 'Users',
  audit: 'Audit log',
};

export interface Crumb {
  label: string;
  to: string;
}

export function breadcrumbsFor(pathname: string, role: Role): Crumb[] {
  const parts = pathname.split('/').filter(Boolean);
  let acc = '';
  return parts.map((part, i) => {
    acc += `/${part}`;
    // Customers reach invoice details from "My invoices", not the staff list.
    if (i === 0 && part === 'invoices' && role === 'CUSTOMER') return { label: 'My invoices', to: '/my-invoices' };
    return { label: SEGMENT_LABELS[part] ?? 'Details', to: acc };
  });
}
