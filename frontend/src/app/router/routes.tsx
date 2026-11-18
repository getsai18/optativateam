import { Navigate, Route, Routes } from 'react-router-dom';
import { AuditPage } from '../../features/audit';
import { LoginPage, ROLE_HOME, useAuth } from '../../features/auth';
import { FeaturesPage, ServicesPage } from '../../features/catalog';
import { CustomersPage } from '../../features/customers';
import { DashboardPage } from '../../features/dashboard';
import {
  EditInvoicePage,
  InvoiceDetailPage,
  InvoicesPage,
  MyInvoicesPage,
  NewInvoicePage,
  ReceiptPage,
} from '../../features/invoices';
import { TaxesPage } from '../../features/taxes';
import { UsersPage } from '../../features/users';
import { EmptyState, LinkButton } from '../../shared/components/ui';
import { useI18n } from '../../shared/i18n';
import { AppLayout } from '../layouts/AppLayout';
import { AuthLayout } from '../layouts/AuthLayout';
import { ProtectedRoute } from './ProtectedRoute';
import { RoleGuard } from './RoleGuard';

function HomeRedirect() {
  const { role } = useAuth();
  return <Navigate to={role ? ROLE_HOME[role] : '/login'} replace />;
}

function NotFound() {
  const { t } = useI18n();
  return (
    <EmptyState
      title={t('notFound.title')}
      description={t('notFound.description')}
      action={
        <LinkButton to="/" variant="primary">
          {t('notFound.action')}
        </LinkButton>
      }
    />
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="/invoices/:id/receipt" element={<ReceiptPage />} />

        <Route element={<AppLayout />}>
          <Route index element={<HomeRedirect />} />

          <Route element={<RoleGuard allow={['ADMIN', 'BILLER']} />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/services" element={<ServicesPage />} />
            <Route path="/invoices" element={<InvoicesPage />} />
            <Route path="/invoices/new" element={<NewInvoicePage />} />
            <Route path="/invoices/:id/edit" element={<EditInvoicePage />} />
          </Route>

          <Route element={<RoleGuard allow={['ADMIN']} />}>
            <Route path="/features" element={<FeaturesPage />} />
            <Route path="/taxes" element={<TaxesPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/audit" element={<AuditPage />} />
          </Route>

          <Route element={<RoleGuard allow={['CUSTOMER']} />}>
            <Route path="/my-invoices" element={<MyInvoicesPage />} />
          </Route>

          {/* Access to a single invoice is enforced per record by the service layer. */}
          <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  );
}
