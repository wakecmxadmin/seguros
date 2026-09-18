import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Plus, Search } from 'lucide-react';
import { Page } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/ui/table';
import { EmptyState, Loading, LoadError } from '@/components/ui/states';
import { api, errorMessage } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/format';
import { Modal, QuoteKind, QuotePosition, QuoteStatus } from '@/lib/enums';
import { useAuth } from '@/stores/auth';

interface QuoteRow {
  id: string;
  number: number;
  reference: string | null;
  kind: keyof typeof QuoteKind;
  status: keyof typeof QuoteStatus;
  position: keyof typeof QuotePosition;
  issueDate: string;
  pendingLimitDate: string | null;
  insuredAmount: string;
  premiumClient: string;
  modal: keyof typeof Modal;
  client: { id: string; legalName: string; tradeName: string | null };
  partner: { id: string; legalName: string; tradeName: string | null } | null;
  insurer: { id: string; legalName: string; tradeName: string | null } | null;
  salesperson: { id: string; name: string } | null;
  currency: { code: string } | null;
  policy: { number: string } | null;
}

/**
 * Cor por status — preserva a leitura que os usuários já têm do legado
 * (amarelo/rosa/branco), trocando a linha inteira colorida por badge + faixa
 * na borda, que mantém o contraste do texto.
 */
const STATUS_STYLE = {
  QUOTE: { variant: 'quote' as const, accent: 'hsl(var(--status-quote))' },
  PROVISIONAL: { variant: 'provisional' as const, accent: 'hsl(var(--status-provisional))' },
  FINAL: { variant: 'final' as const, accent: 'hsl(var(--status-final))' },
};

const POSITION_VARIANT: Record<string, 'neutral' | 'success' | 'warning' | 'danger'> = {
  OPEN_PROPOSAL: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  PENDING: 'warning',
  FOLLOW_UP: 'neutral',
  CANCELED: 'neutral',
};

export default function QuoteList() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [kind, setKind] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['quotes', search, status, kind, page],
    queryFn: async () => {
      const { data } = await api.get('/quotes', {
        params: {
          ...(search ? { search } : {}),
          ...(status ? { status } : {}),
          ...(kind ? { kind } : {}),
          page,
          perPage: 50,
        },
      });
      return data as { items: QuoteRow[]; total: number; page: number; pages: number };
    },
  });

  const { data: summary } = useQuery({
    queryKey: ['quotes-summary'],
    queryFn: async () => {
      const { data } = await api.get('/quotes/summary');
      return data as { open: number; approved: number; overduePendingLimit: number };
    },
  });

  const items = data?.items ?? [];

  const columns: Column<QuoteRow>[] = [
    {
      key: 'number',
      header: 'Processo',
      width: '110px',
      render: (row) => (
        <div>
          <span className="tabular block font-medium text-foreground">{row.number}</span>
          <span className="block text-[12px] text-muted-foreground">{formatDate(row.issueDate)}</span>
        </div>
      ),
    },
    {
      key: 'reference',
      header: 'Referência',
      width: '120px',
      render: (row) => row.reference || <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'client',
      header: 'Cliente',
      render: (row) => (
        <div className="min-w-0">
          <span className="block truncate text-foreground">
            {row.client.tradeName || row.client.legalName}
          </span>
          {row.partner && (
            <span className="block truncate text-[12px] text-muted-foreground">
              via {row.partner.tradeName || row.partner.legalName}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'insurer',
      header: 'Seguradora',
      width: '160px',
      render: (row) =>
        row.insurer ? (
          <span className="block truncate">{row.insurer.tradeName || row.insurer.legalName}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'kind',
      header: 'Tipo',
      width: '130px',
      render: (row) => (
        <span>
          {QuoteKind[row.kind]}
          <span className="block text-[12px] text-muted-foreground">{Modal[row.modal]}</span>
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Situação',
      width: '190px',
      render: (row) => (
        <div className="flex flex-wrap items-center gap-1">
          <Badge variant={STATUS_STYLE[row.status].variant} dot>
            {QuoteStatus[row.status]}
          </Badge>
          <Badge variant={POSITION_VARIANT[row.position] ?? 'neutral'}>
            {QuotePosition[row.position]}
          </Badge>
        </div>
      ),
    },
    {
      key: 'salesperson',
      header: 'Vendedor',
      width: '150px',
      render: (row) =>
        row.salesperson ? (
          <span className="block truncate">{row.salesperson.name}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'insuredAmount',
      header: 'I.S.',
      numeric: true,
      render: (row) => (
        <span>
          {formatMoney(row.insuredAmount)}
          <span className="ml-1 text-[12px] text-muted-foreground">{row.currency?.code}</span>
        </span>
      ),
    },
    {
      key: 'premium',
      header: 'Prêmio',
      numeric: true,
      render: (row) => formatMoney(row.premiumClient),
    },
    {
      key: 'policy',
      header: 'Apólice',
      width: '110px',
      render: (row) => row.policy?.number || <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'pending',
      header: 'Limite',
      width: '120px',
      render: (row) => {
        if (!row.pendingLimitDate) return <span className="text-muted-foreground">—</span>;
        const overdue = new Date(row.pendingLimitDate) < new Date();
        return (
          <span
            className={`tabular inline-flex items-center gap-1 ${overdue ? 'text-danger' : 'text-muted-foreground'}`}
          >
            {overdue && <AlertTriangle className="h-3.5 w-3.5" />}
            {formatDate(row.pendingLimitDate)}
          </span>
        );
      },
    },
  ];

  return (
    <Page
      title="Cotações"
      description="Processos de seguro de transporte, da proposta à averbação."
      wide
      actions={
        can('quote:create') && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate('/quotes/new?kind=EXPORT')}>
              <Plus className="h-4 w-4" />
              Exportação
            </Button>
            <Button onClick={() => navigate('/quotes/new?kind=IMPORT')}>
              <Plus className="h-4 w-4" />
              Importação
            </Button>
          </div>
        )
      }
    >
      {/* Indicadores só do que exige ação — não é um dashboard decorativo. */}
      {summary && (summary.open > 0 || summary.overduePendingLimit > 0) && (
        <div className="mb-4 flex flex-wrap gap-2.5">
          {summary.open > 0 && (
            <button
              onClick={() => {
                setStatus('QUOTE');
                setPage(1);
              }}
              className="rounded-md border border-border bg-surface px-3.5 py-2 text-left transition-colors hover:bg-surface-alt"
            >
              <span className="tabular block text-[18px] font-semibold text-foreground">
                {summary.open}
              </span>
              <span className="text-[12.5px] text-muted-foreground">aguardando decisão</span>
            </button>
          )}
          {summary.overduePendingLimit > 0 && (
            <div className="rounded-md border border-danger/25 bg-danger/6 px-3.5 py-2">
              <span className="tabular block text-[18px] font-semibold text-danger">
                {summary.overduePendingLimit}
              </span>
              <span className="text-[12.5px] text-danger/80">com prazo vencido</span>
            </div>
          )}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[260px] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar por processo, cliente, referência ou fatura"
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-1 rounded-md border border-border bg-surface p-0.5">
          {[
            { value: '', label: 'Todas' },
            { value: 'QUOTE', label: 'Cotações' },
            { value: 'PROVISIONAL', label: 'Provisórias' },
            { value: 'FINAL', label: 'Definitivas' },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => {
                setStatus(option.value);
                setPage(1);
              }}
              className={`rounded px-3 py-1.5 text-[13px] font-medium transition-colors ${
                status === option.value
                  ? 'bg-navy/8 text-navy'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-md border border-border bg-surface p-0.5">
          {[
            { value: '', label: 'Ambos' },
            { value: 'IMPORT', label: 'Importação' },
            { value: 'EXPORT', label: 'Exportação' },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => {
                setKind(option.value);
                setPage(1);
              }}
              className={`rounded px-3 py-1.5 text-[13px] font-medium transition-colors ${
                kind === option.value
                  ? 'bg-navy/8 text-navy'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
        {isLoading ? (
          <Loading />
        ) : isError ? (
          <LoadError message={errorMessage(error)} />
        ) : items.length === 0 ? (
          <EmptyState
            title="Nenhuma cotação encontrada"
            description={
              search || status || kind
                ? 'Ajuste a busca ou os filtros.'
                : 'Crie a primeira cotação de importação ou exportação.'
            }
            action={
              can('quote:create') && !search && !status && !kind ? (
                <Button onClick={() => navigate('/quotes/new?kind=IMPORT')}>
                  <Plus className="h-4 w-4" />
                  Nova cotação
                </Button>
              ) : undefined
            }
          />
        ) : (
          <DataTable
            columns={columns}
            rows={items}
            rowKey={(r) => r.id}
            rowAccent={(r) => STATUS_STYLE[r.status].accent}
            onRowClick={(r) => navigate(`/quotes/${r.id}`)}
          />
        )}
      </div>

      {data && items.length > 0 && (
        <div className="mt-3 flex items-center justify-between">
          <p className="text-[13px] text-muted-foreground">
            {data.total} processo{data.total === 1 ? '' : 's'}
            {data.pages > 1 && ` · página ${data.page} de ${data.pages}`}
          </p>
          {data.pages > 1 && (
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
          )}
        </div>
      )}
    </Page>
  );
}
