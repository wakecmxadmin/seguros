import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { AuthLayout } from '@/layouts/AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { useAuth } from '@/stores/auth';
import { errorMessage } from '@/lib/api';

const schema = z.object({
  email: z.string().min(1, 'Informe seu e-mail.').email('E-mail inválido.'),
  password: z.string().min(1, 'Informe sua senha.'),
});

type FormValues = z.infer<typeof schema>;

export default function SignIn() {
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [signInError, setSignInError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(values: FormValues) {
    setSignInError(null);
    try {
      await signIn(values.email, values.password);
      const target = (location.state as { from?: string })?.from ?? '/';
      navigate(target, { replace: true });
    } catch (error) {
      setSignInError(errorMessage(error, 'Não foi possível entrar. Tente novamente.'));
    }
  }

  return (
    <AuthLayout
      title="Entrar"
      description="Acesse com o e-mail cadastrado pela sua empresa."
      footer={
        <p className="text-center text-[13px] text-muted-foreground">
          Problemas para acessar? Fale com o administrador do sistema.
        </p>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        {signInError && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-md border border-danger/25 bg-danger/8 px-3.5 py-3 text-[13px] text-danger animate-fade-in"
          >
            <AlertCircle className="mt-px h-4 w-4 shrink-0" />
            <span>{signInError}</span>
          </div>
        )}

        <Field label="E-mail" htmlFor="email" error={errors.email?.message}>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="nome@empresa.com.br"
              invalid={!!errors.email}
              className="h-11 rounded-lg pl-10"
              {...register('email')}
            />
          </div>
        </Field>

        <Field label="Senha" htmlFor="password" error={errors.password?.message}>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              className="h-11 rounded-lg pl-10 pr-11"
              invalid={!!errors.password}
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-1 top-1/2 grid h-8 w-9 -translate-y-1/2 place-items-center rounded text-muted-foreground transition-colors hover:text-foreground"
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>

        <div className="flex justify-end">
          <Link
            to="/forgot-password"
            className="text-[13px] font-medium text-teal transition-colors hover:text-teal-hover"
          >
            Esqueci minha senha
          </Link>
        </div>

        <Button type="submit" className="h-11 w-full rounded-lg" size="lg" loading={isSubmitting}>
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
    </AuthLayout>
  );
}
