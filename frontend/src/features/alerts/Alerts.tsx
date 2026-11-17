import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react';
import { Page } from '@/components/ui/page';
import { Loading, LoadError } from '@/components/ui/states';
import { api, errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface AlertItem {
  id: string;
  target: { kind: 'quote' | 'endorsement' | 'policy'; id: string };
  title: string;
  subtitle: string | null;
  date: string;
  overdue: boolean;
  detail: string;
}

export interface AlertGroup {
  key: string;
  title: string;
  description: string;
  total: number;
  items: AlertItem[];
}

export interface AlertsData {
  groups: AlertGroup[];
  total: number;
}

/** Mesma chave para a tela e para o número no menu — uma requisição só. */
export const alertsQuery = {
  queryKey: ['alerts'],
  queryFn: async () => (await api.get('/alerts')).data as AlertsData,
  // Pendência muda devagar; não precisa martelar o backend.
  staleTime: 60_000,
  refetchInterval: 5 * 60_000,
};

const linkTo = (target: AlertItem['target']) =>
  target.kind === 'quote'
    ? `/quotes/${target.id}`
    : target.kind === 'endorsement'
      ? `/endorsements?open=${target.id}`
      : '/registrations/policies';

/**
 * Pendências do operador — o que está vencido ou parado, calculado na hora.
 * Não é painel de métricas: cada linha leva ao registro que precisa de ação.
 */
export default function Alerts() {
  const { data, isLoading, isError, error } = useQuery(alertsQuery);

  return (
    <Page
      title="Pendências"
      description="Prazos, provisórias e cotações que precisam de ação. Os limites de dias ficam em Configurações → Parâmetros."
    >
      {isLoading ? (
        <Loading />
      ) : isError ? (
        <LoadError message={errorMessage(error)} />
      ) : !data?.groups.length ? (
        <p className="text-[14px] text-muted-foreground">Seu perfil não acompanha nenhuma fila de pendências.</p>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {data.groups.map((group) => (
            <section key={group.key} className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
              <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
                <div>
                  <h2 className="text-[15px] font-semibold text-foreground">{group.title}</h2>
                  <p className="mt-0.5 text-[12.5px] text-muted-foreground">{group.description}</p>
                </div>
                <span
                  className={cn(
                    'tabular rounded-full px-2.5 py-0.5 text-[13px] font-semibold',
                    group.total ? 'bg-danger/10 text-danger' : 'bg-surface-alt text-muted-foreground',
                  )}
                >
                  {group.total}
                </span>
              </header>

              {group.items.length === 0 ? (
                <p className="flex items-center gap-2 px-4 py-6 text-[13.5px] text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-teal" />
                  Nada pendente.
                </p>
              ) : (
                <ul className="max-h-[420px] divide-y divide-border overflow-y-auto">
                  {group.items.map((item) => (
                    <li key={item.id}>
                      <Link
                        to={linkTo(item.target)}
                        className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-alt"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="tabular truncate text-[13.5px] font-medium text-foreground">{item.title}</p>
                          {item.subtitle && (
                            <p className="truncate text-[12.5px] text-muted-foreground">{item.subtitle}</p>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <p
                            className={cn(
                              'tabular flex items-center justify-end gap-1 text-[13px]',
                              item.overdue ? 'font-medium text-danger' : 'text-foreground',
                            )}
                          >
                            {item.overdue && <AlertTriangle className="h-3.5 w-3.5" />}
                            {formatDate(item.date)}
                          </p>
                          <p className="text-[12px] text-muted-foreground">{item.detail}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                      </Link>
                    </li>
                  ))}
                  {group.total > group.items.length && (
                    <li className="px-4 py-2 text-[12.5px] text-muted-foreground">
                      Mostrando {group.items.length} de {group.total}.
                    </li>
                  )}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </Page>
  );
}
