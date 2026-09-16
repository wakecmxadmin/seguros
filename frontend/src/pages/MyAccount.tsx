import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Laptop, LogOut, ShieldCheck } from 'lucide-react';
import { Page } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { Loading } from '@/components/ui/states';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PasswordRequirements, isPasswordValid } from '@/components/ui/password-requirements';
import { api, errorMessage, tokens } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { useAuth } from '@/stores/auth';

interface Session {
  id: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
  current: boolean;
}

/** Extrai navegador e sistema do user-agent, para a lista ficar legível. */
function describeDevice(userAgent: string | null) {
  if (!userAgent) return 'Dispositivo desconhecido';

  const browser =
    /Edg\//.test(userAgent) ? 'Edge'
    : /OPR\//.test(userAgent) ? 'Opera'
    : /Chrome\//.test(userAgent) ? 'Chrome'
    : /Safari\//.test(userAgent) ? 'Safari'
    : /Firefox\//.test(userAgent) ? 'Firefox'
    : 'Navegador';

  const os =
    /Windows/.test(userAgent) ? 'Windows'
    : /Mac OS X|Macintosh/.test(userAgent) ? 'macOS'
    : /Android/.test(userAgent) ? 'Android'
    : /iPhone|iPad/.test(userAgent) ? 'iOS'
    : /Linux/.test(userAgent) ? 'Linux'
    : '';

  return os ? `${browser} · ${os}` : browser;
}

export default function MyAccount() {
  const { user, signOut } = useAuth();

  return (
    <Page
      title="Minha conta"
      description="Seus dados de acesso, senha e sessões abertas."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <ProfileCard />
          <PasswordCard onChanged={signOut} />
        </div>
        <SessionsCard currentUserName={user?.name ?? ''} />
      </div>
    </Page>
  );
}

function ProfileCard() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
      <header className="border-b border-border px-5 py-3.5">
        <h2 className="text-[15px] font-semibold text-foreground">Dados</h2>
      </header>
      <dl className="divide-y divide-border">
        {[
          ['Nome', user.name],
          ['E-mail', user.email],
          ['Cargo', user.jobTitle || '—'],
          ['Setor', user.department || '—'],
          ['Último acesso', formatDateTime(user.lastLoginAt)],
        ].map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 px-5 py-2.5">
            <dt className="text-[13.5px] text-muted-foreground">{label}</dt>
            <dd className="text-right text-[14px] text-foreground">{value}</dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-4 px-5 py-2.5">
          <dt className="text-[13.5px] text-muted-foreground">Papéis</dt>
          <dd className="flex flex-wrap justify-end gap-1">
            {user.roles.map((r) => (
              <Badge key={r.slug} variant="info">
                {r.name}
              </Badge>
            ))}
          </dd>
        </div>
      </dl>
      <p className="border-t border-border bg-surface-alt/50 px-5 py-2.5 text-[12.5px] text-muted-foreground">
        Para alterar nome, cargo ou papéis, fale com um administrador.
      </p>
    </section>
  );
}

function PasswordCard({ onChanged }: { onChanged: () => void }) {
  const [values, setValues] = useState({
    currentPassword: '',
    newPassword: '',
    confirmation: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const change = useMutation({
    mutationFn: () =>
      api.post('/auth/change-password', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      }),
    onSuccess: async ({ data }) => {
      toast.success(data.message ?? 'Senha alterada.');
      // Trocar a senha derruba todas as sessões — inclusive esta.
      setTimeout(onChanged, 1200);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};

    if (!values.currentPassword) found.currentPassword = 'Informe a senha atual.';
    if (!isPasswordValid(values.newPassword)) {
      found.newPassword = 'A nova senha não atende aos requisitos.';
    }
    if (values.newPassword !== values.confirmation) {
      found.confirmation = 'As senhas não conferem.';
    }
    if (values.currentPassword && values.currentPassword === values.newPassword) {
      found.newPassword = 'A nova senha deve ser diferente da atual.';
    }

    setErrors(found);
    if (Object.keys(found).length) return;
    change.mutate();
  }

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
      <header className="border-b border-border px-5 py-3.5">
        <h2 className="text-[15px] font-semibold text-foreground">Alterar senha</h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Ao trocar a senha, todas as suas sessões são encerradas.
        </p>
      </header>

      <form onSubmit={submit} noValidate className="space-y-4 px-5 py-4">
        <Field label="Senha atual" htmlFor="currentPassword" required error={errors.currentPassword}>
          <Input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            value={values.currentPassword}
            invalid={!!errors.currentPassword}
            onChange={(e) => setValues((v) => ({ ...v, currentPassword: e.target.value }))}
          />
        </Field>

        <div>
          <Field label="Nova senha" htmlFor="newPassword" required error={errors.newPassword}>
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              value={values.newPassword}
              invalid={!!errors.newPassword}
              onChange={(e) => setValues((v) => ({ ...v, newPassword: e.target.value }))}
            />
          </Field>
          <PasswordRequirements password={values.newPassword} />
        </div>

        <Field label="Repita a nova senha" htmlFor="confirmation" required error={errors.confirmation}>
          <Input
            id="confirmation"
            type="password"
            autoComplete="new-password"
            value={values.confirmation}
            invalid={!!errors.confirmation}
            onChange={(e) => setValues((v) => ({ ...v, confirmation: e.target.value }))}
          />
        </Field>

        <Button type="submit" loading={change.isPending}>
          <ShieldCheck className="h-4 w-4" />
          Alterar senha
        </Button>
      </form>
    </section>
  );
}

function SessionsCard({ currentUserName }: { currentUserName: string }) {
  const queryClient = useQueryClient();
  const [revoking, setRevoking] = useState<Session | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: async () => {
      const { data } = await api.get('/auth/sessions', {
        params: { refreshToken: tokens.refresh ?? undefined },
      });
      return data as Session[];
    },
  });

  const revoke = useMutation({
    mutationFn: (id: string) => api.delete(`/auth/sessions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      setRevoking(null);
      toast.success('Sessão encerrada.');
    },
    onError: (error) => {
      setRevoking(null);
      toast.error(errorMessage(error));
    },
  });

  const revokeOthers = useMutation({
    mutationFn: () =>
      api.post('/auth/sessions/revoke-others', { refreshToken: tokens.refresh }),
    onSuccess: ({ data }) => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      setRevokingAll(false);
      toast.success(
        data.count === 0
          ? 'Nenhuma outra sessão estava aberta.'
          : `${data.count} sessão(ões) encerrada(s).`,
      );
    },
    onError: (error) => {
      setRevokingAll(false);
      toast.error(errorMessage(error));
    },
  });

  const others = sessions?.filter((s) => !s.current).length ?? 0;

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-surface shadow-card lg:self-start">
      <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-3.5">
        <div>
          <h2 className="text-[15px] font-semibold text-foreground">Sessões abertas</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Onde a conta de {currentUserName.split(' ')[0]} está conectada.
          </p>
        </div>
        {others > 0 && (
          <Button variant="outline" size="sm" onClick={() => setRevokingAll(true)}>
            Encerrar as outras
          </Button>
        )}
      </header>

      {isLoading ? (
        <Loading />
      ) : (
        <ul className="divide-y divide-border">
          {sessions?.map((session) => (
            <li key={session.id} className="flex items-start gap-3 px-5 py-3.5">
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-alt">
                <Laptop className="h-4 w-4 text-muted-foreground" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1.5 text-[14px] font-medium text-foreground">
                  {describeDevice(session.userAgent)}
                  {session.current && (
                    <Badge variant="success" dot>
                      Esta sessão
                    </Badge>
                  )}
                </p>
                <p className="tabular mt-0.5 text-[12.5px] text-muted-foreground">
                  {session.ip ?? 'IP desconhecido'} · iniciada em{' '}
                  {formatDateTime(session.createdAt)}
                </p>
              </div>

              {!session.current && (
                <Button
                  variant="ghost"
                  size="icon"
                  title="Encerrar esta sessão"
                  onClick={() => setRevoking(session)}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {revoking && (
        <ConfirmDialog
          title="Encerrar sessão?"
          description={`A sessão em ${describeDevice(revoking.userAgent)} (${revoking.ip ?? 'IP desconhecido'}) será desconectada imediatamente.`}
          confirmLabel="Encerrar"
          destructive
          loading={revoke.isPending}
          onConfirm={() => revoke.mutate(revoking.id)}
          onCancel={() => setRevoking(null)}
        />
      )}

      {revokingAll && (
        <ConfirmDialog
          title="Encerrar as outras sessões?"
          description={`${others} sessão(ões) serão desconectadas. A sessão atual permanece aberta.`}
          confirmLabel="Encerrar as outras"
          destructive
          loading={revokeOthers.isPending}
          onConfirm={() => revokeOthers.mutate()}
          onCancel={() => setRevokingAll(false)}
        />
      )}
    </section>
  );
}
