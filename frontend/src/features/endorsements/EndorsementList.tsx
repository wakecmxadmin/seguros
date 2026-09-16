import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Anchor, Search, Wallet } from 'lucide-react';
import { Page } from '@/components/ui/page';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/ui/table';
import { EmptyState, Loading, LoadError } from '@/components/ui/states';
import { api, errorMessage } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/format';
import { EndorsementDrawer } from './EndorsementDrawer';

export interface EndorsementRow {
  id: string;
  number: string;
  type: 'PROVISIONAL' | 'FINAL';
  position: 'PENDING' | 'FOLLOW_UP' | 'SETTLED' | 'CANCELED';
  issuedAt: string;
  berthingDate: string | null;
  blNumber: string | null;
  containerNumber: string | null;
  insuredAmount: string;
  premiumClient: string;
  premiumInsurer: string;
  balance: string;
  balancePercent: string;
  currency: { code: string } | null;
  vessel: { id: string; name: string } | null;
  quote: {
    id: string;
    number: number;
    kind: 'IMPORT' | 'EXPORT';
    client: { legalName: string; tradeName: string | null };
    partner: { legalName: string; tradeName: string | null } | null;
    insurer: { legalName: string; tradeName: string | null } | null;
  };
}

export const TYPE_LABEL = { PROVISIONAL: 'Provisória', FINAL: 'Definitiva' };

export const POSITION_LABEL = {
  PENDING: 'Pendente',
  FOLLOW_UP: 'Follow-up',
  SETTLED: 'Baixada',
  CANCELED: 'Cancelada',
};

const POSITION_VARIANT: Record<string, 'warning' | 'neutral' | 'success' | 'danger'> = {
  PENDING: 'warning',
  FOLLOW_UP: 'neutral',
  SETTLED: 'success',
  CANCELED: 'danger',
};

export default function EndorsementList() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [position, setPosition] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['endorsements', search, type, position],
    queryFn: async () => {
      const { data } = await api.get('/endorsements', {
        params: {
          ...(search ? { search } : {}),
          ...(type ? { type } : {}),
          ...(position ? { position } : {}),
          perPage: 50,
        },
      });
      return data as { items: EndorsementRow[]; total: number };
    },
  });

  const { data: summary } = useQuery({
    queryKey: ['endorsements-summary'],
    queryFn: async () => {
      const { data } = await api.get('/endorsements/summary');
      return data as {
        pendingProvisionals: number;
        provisionalsWithBalance: number;
        finalsInFollowUp: number;
      };
    },
  });

  const items = data?.items ?? [];

  const columns: Column<EndorsementRow>[] = [
    {
      key: 'number',
      header: 'Averbação',
      width: '140px',
      render: (row) => (
        <div>
          <span className="tabular block font-medium text-foreground">{row.number}</span>
          <span className="block text-[12px] text-muted-foreground">
            proc. {row.quote.number} · {formatDate(row.issuedAt)}
          </span>
        </div>
      ),
    },
    {
      key: 'client',
      header: 'Cliente',
      render: (row) => (
        <div className="min-w-0">
          <span className="block truncate text-foreground">
            {row.quote.client.tradeName || row.quote.client.legalName}
          </span>
          {row.quote.partner && (
            <span className="block truncate text-[12px] text-muted-foreground">
              via {row.quote.partner.tradeName || row.quote.partner.legalName}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Tipo',
      width: '160px',
      render: (row) => (
        <div className="flex flex-wrap items-center gap-1">
          <Badge variant={row.type === 'PROVISIONAL' ? 'provisional' : 'final'} dot>
            {TYPE_LABEL[row.type]}
          </Badge>
        </div>
      ),
    },
    {
      key: 'position',
      header: 'Posição',
      width: '120px',
      render: (row) => (
        <Badge variant={POSITION_VARIANT[row.position] ?? 'neutral'}>
          {POSITION_LABEL[row.position]}
        </Badge>
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
      key: 'balance',
      header: 'Saldo',
      numeric: true,
      render: (row) => {
        if (row.type === 'FINAL') return <span className="text-muted-foreground">—</span>;
        const percent = Number(row.balancePercent);
        return (
          <span className={percent === 0 ? 'text-muted-foreground' : 'text-foreground'}>
            {formatMoney(row.balance)}
            <span className="ml-1 text-[12px] text-muted-foreground">{percent.toFixed(0)}%</span>
          </span>
        );
      },
    },
    {
      key: 'berthing',
      header: 'Atracação',
      width: '120px',
      render: (row) =>
        row.berthingDate ? (
          <span className="tabular inline-flex items-center gap-1 text-muted-foreground">
            <Anchor className="h-3.5 w-3.5" />
            {formatDate(row.berthingDate)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];

  return (
    <Page
      title="Averbações"
      description="Provisórias abrem saldo; definitivas consomem esse saldo até zerá-lo."
    >
      {summary && (
        <div className="mb-4 flex flex-wrap gap-2.5">
          {summary.pendingProvisionals > 0 && (
            <button
              onClick={() => {
                setType('PROVISIONAL');
                setPosition('PENDING');
              }}
              className="rounded-md border border-border bg-surface px-3.5 py-2 text-left transition-colors hover:bg-surface-alt"
            >
              <span className="tabular block text-[18px] font-semibold text-foreground">
                {summary.pendingProvisionals}
              </span>
              <span className="text-[12.5px] text-muted-foreground">provisórias pendentes</span>
            </button>
          )}
          {summary.provisionalsWithBalance > 0 && (
            <div className="rounded-md border border-border bg-surface px-3.5 py-2">
              <span className="tabular flex items-center gap-1.5 text-[18px] font-semibold text-foreground">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                {summary.provisionalsWithBalance}
              </span>
              <span className="text-[12.5px] text-muted-foreground">com saldo a averbar</span>
            </div>
          )}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[260px] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por averbação, BL, container ou cliente"
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-1 rounded-md border border-border bg-surface p-0.5">
          {[
            { value: '', label: 'Todas' },
            { value: 'PROVISIONAL', label: 'Provisórias' },
            { value: 'FINAL', label: 'Definitivas' },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setType(option.value)}
              className={`rounded px-3 py-1.5 text-[13px] font-medium transition-colors ${
                type === option.value
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
            { value: '', label: 'Qualquer posição' },
            { value: 'PENDING', label: 'Pendentes' },
            { value: 'FOLLOW_UP', label: 'Follow-up' },
            { value: 'SETTLED', label: 'Baixadas' },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setPosition(option.value)}
              className={`rounded px-3 py-1.5 text-[13px] font-medium transition-colors ${
                position === option.value
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
            title="Nenhuma averbação encontrada"
            description={
              search || type || position
                ? 'Ajuste a busca ou os filtros.'
                : 'As averbações são emitidas a partir de cotações aprovadas.'
            }
          />
        ) : (
          <DataTable
            columns={columns}
            rows={items}
            rowKey={(r) => r.id}
            rowAccent={(r) =>
              r.type === 'PROVISIONAL'
                ? 'hsl(var(--status-provisional))'
                : 'hsl(var(--status-final))'
            }
            onRowClick={(r) => setSelectedId(r.id)}
          />
        )}
      </div>

      {data && items.length > 0 && (
        <p className="mt-3 text-[13px] text-muted-foreground">
          {data.total} {data.total === 1 ? 'averbação' : 'averbações'}
        </p>
      )}

      {selectedId && (
        <EndorsementDrawer id={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </Page>
  );
}
