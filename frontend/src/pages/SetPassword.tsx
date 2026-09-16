import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react';
import { AuthLayout } from '@/layouts/AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { PasswordRequirements, isPasswordValid } from '@/components/ui/password-requirements';
import { api, errorMessage } from '@/lib/api';

const schema = z
  .object({
    password: z.string().refine(isPasswordValid, 'A senha não atende aos requisitos.'),
    confirmation: z.string().min(1, 'Repita a senha.'),
  })
  .refine((d) => d.password === d.confirmation, {
    path: ['confirmation'],
    message: 'As senhas não conferem.',
  });

type FormValues = z.infer<typeof schema>;

interface TokenInfo {
  type: 'RECOVERY' | 'FIRST_ACCESS';
  name: string;
  email: string;
}

/** Atende tanto `/reset-password` quanto `/first-access` — o texto muda conforme o token. */
export default function SetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';

  const [validating, setValidating] = useState(true);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), mode: 'onChange' });

  const password = watch('password') ?? '';

  useEffect(() => {
    if (!token) {
      setTokenError('Link inválido: o endereço não contém um token.');
      setValidating(false);
      return;
    }
    api
      .get('/auth/validate-token', { params: { token } })
      .then(({ data }) => setTokenInfo(data))
      .catch((error) => setTokenError(errorMessage(error, 'Este link é inválido ou expirou.')))
      .finally(() => setValidating(false));
  }, [token]);

  async function onSubmit(values: FormValues) {
    setSubmitError(null);
    try {
      await api.post('/auth/reset-password', { token, password: values.password });
      setDone(true);
      setTimeout(() => navigate('/sign-in', { replace: true }), 2200);
    } catch (error) {
      setSubmitError(errorMessage(error));
    }
  }

  // --- Estados de exceção ---------------------------------------------------

  if (validating) {
    return (
      <AuthLayout title="Verificando link…">
        <div className="flex items-center gap-2.5 text-[15px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Aguarde um instante.
        </div>
      </AuthLayout>
    );
  }

  if (tokenError) {
    return (
      <AuthLayout
        title="Link expirado"
        description="Links de definição de senha têm prazo de validade e só podem ser usados uma vez."
      >
        <div className="space-y-6">
          <div className="flex items-start gap-2.5 rounded-md border border-danger/25 bg-danger/8 px-3.5 py-3 text-[13px] text-danger">
            <AlertCircle className="mt-px h-4 w-4 shrink-0" />
            <span>{tokenError}</span>
          </div>
          <Button asChild className="w-full" size="lg">
            <Link to="/forgot-password">Solicitar um novo link</Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout title="Senha definida" description="Tudo certo. Redirecionando para o login…">
        <div className="flex items-start gap-2.5 rounded-md border border-success/25 bg-success/8 px-3.5 py-3 text-[13px] text-success">
          <CheckCircle2 className="mt-px h-4 w-4 shrink-0" />
          <span>Sua senha foi salva. Use-a para entrar no sistema.</span>
        </div>
      </AuthLayout>
    );
  }

  // --- Formulário -----------------------------------------------------------

  const firstAccess = tokenInfo?.type === 'FIRST_ACCESS';

  return (
    <AuthLayout
      title={firstAccess ? `Bem-vindo(a), ${tokenInfo?.name.split(' ')[0]}` : 'Criar nova senha'}
      description={
        firstAccess ? (
          <>
            Defina uma senha para acessar o sistema com{' '}
            <strong className="text-foreground">{tokenInfo?.email}</strong>.
          </>
        ) : (
          <>
            Você está definindo uma nova senha para{' '}
            <strong className="text-foreground">{tokenInfo?.email}</strong>.
          </>
        )
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        {submitError && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-md border border-danger/25 bg-danger/8 px-3.5 py-3 text-[13px] text-danger animate-fade-in"
          >
            <AlertCircle className="mt-px h-4 w-4 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        <div>
          <Field label="Nova senha" htmlFor="password" error={errors.password?.message}>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                autoFocus
                className="pr-11"
                invalid={!!errors.password}
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-1 top-1 grid h-8 w-9 place-items-center rounded text-muted-foreground transition-colors hover:text-foreground"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>
          <PasswordRequirements password={password} />
        </div>

        <Field label="Repita a senha" htmlFor="confirmation" error={errors.confirmation?.message}>
          <Input
            id="confirmation"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            invalid={!!errors.confirmation}
            {...register('confirmation')}
          />
        </Field>

        <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
          {isSubmitting ? 'Salvando…' : firstAccess ? 'Definir senha e acessar' : 'Salvar nova senha'}
        </Button>
      </form>
    </AuthLayout>
  );
}
