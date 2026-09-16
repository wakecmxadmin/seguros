import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { AuthLayout } from '@/layouts/AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { api } from '@/lib/api';

const schema = z.object({
  email: z.string().min(1, 'Informe seu e-mail.').email('E-mail inválido.'),
});

type FormValues = z.infer<typeof schema>;

export default function ForgotPassword() {
  const [sentTo, setSentTo] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    // A API responde sucesso mesmo se o e-mail não existir — não revelamos
    // quais endereços estão cadastrados.
    await api.post('/auth/forgot-password', { email: values.email });
    setSentTo(values.email);
  }

  if (sentTo) {
    return (
      <AuthLayout
        title="Verifique seu e-mail"
        description={
          <>
            Se houver uma conta para <strong className="text-foreground">{sentTo}</strong>, enviamos
            um link para você criar uma nova senha. Ele vale por 1 hora.
          </>
        }
      >
        <div className="space-y-6">
          <div className="flex items-start gap-3 rounded-md border border-border bg-surface-alt px-4 py-3.5">
            <MailCheck className="mt-0.5 h-[18px] w-[18px] shrink-0 text-teal" />
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Não recebeu? Confira a caixa de spam ou{' '}
              <button
                type="button"
                onClick={() => setSentTo(null)}
                className="font-medium text-teal underline-offset-2 hover:underline"
              >
                tente com outro e-mail
              </button>
              .
            </p>
          </div>

          <Button asChild variant="outline" className="w-full" size="lg">
            <Link to="/sign-in">
              <ArrowLeft className="h-4 w-4" />
              Voltar para o login
            </Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Esqueci minha senha"
      description="Informe seu e-mail e enviaremos um link para você criar uma nova senha."
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <Field label="E-mail" htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="nome@empresa.com.br"
            invalid={!!errors.email}
            {...register('email')}
          />
        </Field>

        <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
          {isSubmitting ? 'Enviando…' : 'Enviar link de recuperação'}
        </Button>

        <Link
          to="/sign-in"
          className="flex items-center justify-center gap-1.5 pt-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar para o login
        </Link>
      </form>
    </AuthLayout>
  );
}
