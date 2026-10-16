import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle } from 'lucide-react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Button, Input } from '../../../shared/components/ui';
import { errorMessage } from '../../../shared/lib/errors';
import { ROLE_HOME, useAuth } from '../hooks/useAuth';
import { useAuthStore } from '../store/authStore';

const schema = z.object({
  email: z.string().trim().min(1, 'Enter your email').email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});
type LoginValues = z.infer<typeof schema>;

export function LoginPage() {
  const { user, login } = useAuth();
  const expired = useAuthStore((s) => s.expired);
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  if (user) {
    return <Navigate to={ROLE_HOME[user.role]} replace />;
  }

  const from = (location.state as { from?: string } | null)?.from;

  const signIn = async (email: string, password: string) => {
    setServerError(null);
    try {
      const claims = await login(email, password);
      // RoleGuard sends the user home if `from` is not allowed for the role.
      navigate(from ?? ROLE_HOME[claims.role], { replace: true });
    } catch (e) {
      setServerError(errorMessage(e));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Welcome back</h1>
        <p className="mt-1 text-sm text-muted">Sign in to your Northwind Billing account.</p>
      </div>

      {expired ? (
        <div role="alert" className="flex items-start gap-2 rounded-control border border-accent/40 bg-accent-soft p-3 text-sm text-ink">
          <AlertCircle size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-accent" />
          Session expired. Please sign in again.
        </div>
      ) : null}
      {serverError ? (
        <div role="alert" className="flex items-start gap-2 rounded-control border border-status-cancelled/30 bg-status-cancelled-bg p-3 text-sm text-status-cancelled">
          <AlertCircle size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
          {serverError}
        </div>
      ) : null}

      <form className="flex flex-col gap-4" noValidate onSubmit={handleSubmit((v) => signIn(v.email, v.password))}>
        <Input label="Email" type="email" autoComplete="username" required error={errors.email?.message} {...register('email')} />
        <Input label="Password" type="password" autoComplete="current-password" required error={errors.password?.message} {...register('password')} />
        <Button type="submit" variant="primary" loading={isSubmitting}>
          Sign in
        </Button>
      </form>
    </div>
  );
}
