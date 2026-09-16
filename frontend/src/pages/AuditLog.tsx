import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Page } from '@/components/ui/page';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Field } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { EmptyState, Loading, LoadError } from '@/components/ui/states';
import { api, errorMessage } from '@/lib/api';
import { formatDateTime, initials } from '@/lib/utils';

interface AuditEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string } | null;
}

/** Ações conhecidas, com rótulo em português e cor. */
const ACTIONS: Record<string, { label: string; variant: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }> = {
  login: { label: 'Entrou no sistema', variant: 'neutral' },
  logout: { label: 'Saiu do sistema', variant: 'neutral' },
  login_locked: { label: 'Conta bloqueada por tentativas', variant: 'danger' },
  session_revoked: { label: 'Sessão encerrada', variant: 'warning' },
  sessions_revoked_others: { label: 'Outras sessões encerradas', variant: 'warning' },
  password_reset: { label: 'Senha redefinida', variant: 'warning' },
  password_changed: { label: 'Senha alterada', variant: 'warning' },
  password_recovery_requested: { label: 'Recuperação de senha solicitada', variant: 'neutral' },
  password_set_first_access: { label: 'Senha definida (1º acesso)', variant: 'success' },
  user_created: { label: 'Usuário criado', variant: 'success' },
  user_updated: { label: 'Usuário editado', variant: 'info' },
  user_deactivated: { label: 'Usuário desativado', variant: 'danger' },
  user_reactivated: { label: 'Usuário reativado', variant: 'success' },
  user_access_resent: { label: 'Acesso reenviado', variant: 'neutral' },
  role_created: { label: 'Papel criado', variant: 'success' },
  role_updated: { label: 'Papel editado', variant: 'info' },
  role_deleted: { label: 'Papel excluído', variant: 'danger' },
  company_created: { label: 'Empresa criada', variant: 'success' },
  company_updated: { label: 'Empresa editada', variant: 'info' },
  company_deleted: { label: 'Empresa excluída', variant: 'danger' },
  employee_created: { label: 'Funcionário criado', variant: 'success' },
  employee_updated: { label: 'Funcionário editado', variant: 'info' },
  employee_deleted: { label: 'Funcionário excluído', variant: 'danger' },
  policy_created: { label: 'Apólice criada', variant: 'success' },
  policy_updated: { label: 'Apólice editada', variant: 'info' },
  policy_deleted: { label: 'Apólice excluída', variant: 'danger' },
  coverage_created: { label: 'Cobertura criada', variant: 'success' },
  coverage_updated: { label: 'Cobertura editada', variant: 'info' },
  catalog_created: { label: 'Registro de domínio criado', variant: 'success' },
  catalog_updated: { label: 'Registro de domínio editado', variant: 'info' },
  catalog_deleted: { label: 'Registro de domínio excluído', variant: 'danger' },
  exchange_rate_set: { label: 'Cotação lançada', variant: 'info' },
  exchange_rate_ptax_import: { label: 'PTAX importada', variant: 'info' },
  quote_created: { label: 'Cotação criada', variant: 'success' },
  quote_updated: { label: 'Cotação editada', variant: 'info' },
  quote_approved: { label: 'Cotação aprovada', variant: 'success' },
  quote_rejected: { label: 'Cotação reprovada', variant: 'danger' },
  quote_canceled: { label: 'Cotação cancelada', variant: 'danger' },
};

const ENTITIES: Record<string, string> = {
  User: 'Usuário',
  Role: 'Papel',
  Company: 'Empresa',
  Employee: 'Funcionário',
  Policy: 'Apólice',
  Coverage: 'Cobertura',
  Quote: 'Cotação',
  ExchangeRate: 'Câmbio',
  RefreshToken: 'Sessão',
  country: 'País',
  state: 'Estado',
  city: 'Cidade',
  port: 'Porto/Aeroporto',
  currency: 'Moeda',
  packaging: 'Embalagem',
  vessel: 'Navio',
  commodityType: 'Tipo de mercadoria',
};

export default function AuditLog() {
  const [action, setAction] = useState('');
  const [entity, setEntity] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: facets } = useQuery({
    queryKey: ['audit-facets'],
    queryFn: async () => {
      const { data } = await api.get('/audit/facets');
      return data as { actions: string[]; entities: string[] };
    },
  });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['audit', action, entity, page],
    queryFn: async () => {
      const { data } = await api.get('/audit', {
        params: {
          ...(action ? { action } : {}),
          ...(entity ? { entity } : {}),
          page,
          perPage: 50,
        },
      });
      return data as { items: AuditEntry[]; total: number; pages: number; page: number };
    },
  });

  const items = data?.items ?? [];

  return (
    <Page
      title="Auditoria"
      description="Quem fez o quê e quando. O sistema antigo não registrava nada disso."
    >
      <div className="mb-4 flex flex-wrap items-end gap-2.5">
        <Field label="Ação" htmlFor="action" className="w-auto min-w-[220px]">
          <Select
            id="action"
            className="h-9"
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todas</option>
            {facets?.actions.map((a) => (
              <option key={a} value={a}>
                {ACTIONS[a]?.label ?? a}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Registro afetado" htmlFor="entity" className="w-auto min-w-[190px]">
          <Select
            id="entity"
            className="h-9"
            value={entity}
            onChange={(e) => {
              setEntity(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos</option>
            {facets?.entities.map((e) => (
              <option key={e} value={e}>
                {ENTITIES[e] ?? e}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
        {isLoading ? (
          <Loading />
        ) : isError ? (
          <LoadError message={errorMessage(error)} />
        ) : items.length === 0 ? (
          <EmptyState
            title="Nenhum registro de auditoria"
            description={
              action || entity
                ? 'Ajuste os filtros para ver outros registros.'
                : 'As ações feitas no sistema aparecerão aqui.'
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((entry) => {
              const meta = ACTIONS[entry.action] ?? {
                label: entry.action,
                variant: 'neutral' as const,
              };
              const hasDetail = !!entry.before || !!entry.after;
              const open = expanded === entry.id;

              return (
                <li key={entry.id}>
                  <div className="flex items-start gap-3 px-4 py-3">
                    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-navy/8 text-[11px] font-semibold text-navy">
                      {entry.user ? initials(entry.user.name) : '—'}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-[14px] font-medium text-foreground">
                          {entry.user?.name ?? 'Sistema'}
                        </span>
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                        <span className="text-[13px] text-muted-foreground">
                          em {ENTITIES[entry.entity] ?? entry.entity}
                        </span>
                      </p>
                      <p className="tabular mt-0.5 text-[12.5px] text-muted-foreground">
                        {formatDateTime(entry.createdAt)}
                        {entry.ip && ` · ${entry.ip}`}
                      </p>
                    </div>

                    {hasDetail && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title={open ? 'Ocultar detalhes' : 'Ver o que mudou'}
                        onClick={() => setExpanded(open ? null : entry.id)}
                      >
                        {open ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>

                  {open && (
                    <div className="grid gap-3 border-t border-border bg-surface-alt/40 px-4 py-3 sm:grid-cols-2">
                      <ChangeBlock title="Antes" value={entry.before} />
                      <ChangeBlock title="Depois" value={entry.after} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {data && data.pages > 1 && (
        <div className="mt-3 flex items-center justify-between">
          <p className="text-[13px] text-muted-foreground">
            {data.total} registro{data.total === 1 ? '' : 's'} · página {data.page} de {data.pages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
    </Page>
  );
}

function ChangeBlock({ title, value }: { title: string; value: unknown }) {
  if (!value) {
    return (
      <div>
        <p className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
        <p className="text-[13px] text-muted-foreground">—</p>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <p className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <pre className="overflow-x-auto rounded-md border border-border bg-surface p-2.5 text-[12px] leading-relaxed text-foreground">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
