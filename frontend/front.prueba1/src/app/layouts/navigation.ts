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
  /** i18n key (namespace "app"), e.g. "nav.invoices". */
  label: string;
  icon: LucideIcon;
  /** match only the exact path (used to keep "Invoices" from lighting up on /invoices/new) */
  end?: boolean;
}

export interface NavSection {
  /** i18n key (namespace "app"), e.g. "nav.section.billing". */
  title: string;
  items: NavItem[];
}

const DASHBOARD: NavItem = { to: '/dashboard', label: 'nav.dashboard', icon: LayoutDashboard };
const INVOICES: NavItem = { to: '/invoices', label: 'nav.invoices', icon: FileText, end: true };
const NEW_INVOICE: NavItem = { to: '/invoices/new', label: 'nav.newInvoice', icon: FilePlus2 };

export const NAVIGATION: Record<Role, NavSection[]> = {
  ADMIN: [
    { title: 'nav.section.overview', items: [DASHBOARD] },
    { title: 'nav.section.billing', items: [INVOICES, NEW_INVOICE] },
    {
      title: 'nav.section.catalogPeople',
      items: [
        { to: '/customers', label: 'nav.customers', icon: Users },
        { to: '/services', label: 'nav.services', icon: Package },
        { to: '/features', label: 'nav.features', icon: ListChecks },
        { to: '/taxes', label: 'nav.taxes', icon: Percent },
      ],
    },
    {
      title: 'nav.section.administration',
      items: [
        { to: '/users', label: 'nav.users', icon: UserCog },
        { to: '/audit', label: 'nav.audit', icon: ScrollText },
      ],
    },
  ],
  BILLER: [
    { title: 'nav.section.overview', items: [DASHBOARD] },
    { title: 'nav.section.billing', items: [INVOICES, NEW_INVOICE] },
    {
      title: 'nav.section.directory',
      items: [
        { to: '/customers', label: 'nav.customers', icon: Users },
        { to: '/services', label: 'nav.services', icon: Package },
      ],
    },
  ],
  CUSTOMER: [{ title: 'nav.section.billing', items: [{ to: '/my-invoices', label: 'nav.myInvoices', icon: FileText }] }],
};

const SEGMENT_KEYS: Record<string, string> = {
  dashboard: 'crumb.dashboard',
  invoices: 'crumb.invoices',
  'my-invoices': 'crumb.my-invoices',
  new: 'crumb.new',
  edit: 'crumb.edit',
  receipt: 'crumb.receipt',
  customers: 'crumb.customers',
  services: 'crumb.services',
  features: 'crumb.features',
  taxes: 'crumb.taxes',
  users: 'crumb.users',
  audit: 'crumb.audit',
};

export interface Crumb {
  /** i18n key (namespace "app"). */
  label: string;
  to: string;
}

export function breadcrumbsFor(pathname: string, role: Role): Crumb[] {
  const parts = pathname.split('/').filter(Boolean);
  let acc = '';
  return parts.map((part, i) => {
    acc += `/${part}`;
    // Customers reach invoice details from "My invoices", not the staff list.
    if (i === 0 && part === 'invoices' && role === 'CUSTOMER') return { label: 'crumb.my-invoices', to: '/my-invoices' };
    return { label: SEGMENT_KEYS[part] ?? 'crumb.detail', to: acc };
  });
}
