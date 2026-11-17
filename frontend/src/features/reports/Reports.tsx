import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download, TriangleAlert } from 'lucide-react';
import { Page } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Field } from '@/components/ui/field';
import { Combobox } from '@/components/ui/combobox';
import { downloadFile } from '@/lib/download';
import { EmptyState, Loading, LoadError } from '@/components/ui/states';
import { api, errorMessage } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/format';
import { useAuth } from '@/stores/auth';
import { cn } from '@/lib/utils';

type Tab = 'production' | 'client' | 'partner' | 'policy' | 'state';

const TABS: { value: Tab; label: string; permission: string }[] = [
  { value: 'production', label: 'Produção', permission: 'report:production' },
  { value: 'client', label: 'Por cliente', permission: 'report:ranking' },
  { value: 'partner', label: 'Por parceiro', permission: 'report:ranking' },
  { value: 'policy', label: 'Por apólice', permission: 'report:ranking' },
  { value: 'state', label: 'Por estado', permission: 'report:ranking' },
];

interface Filters {
  from: string;
  to: string;
  kind: string;
  clientId: string | null;
  partnerId: string | null;
  insurerId: string | null;
}

interface ProductionRow {
  endorsementId: string;
  endorsementNumber: string;
  issuedAt: string;
  quoteId: string;
  quoteNumber: number;
  kind: 'IMPORT' | 'EXPORT';
  reference: string | null;
  clientName: string;
  partnerName: string | null;
  brlRate: number;
  premiumClientUsd: number;
  premiumClientBrl: number;
  premiumInsurerUsd: number;
  payableUsd: number;
  payableBrl: number;
  diffUsd: number;
  diffBrl: number;
  profitability: number | null;
  resultUsd: number;
  missingRate: boolean;
}

interface ProductionData {
  from: string;
  to: string;
  rows: ProductionRow[];
  totals: Record<string, number | null>;
  missingRates: number;
}

interface RankingRow {
  key: string;
  label: string;
  position: number;
  percent: number;
  insuredUsd: number;
  premiumClientUsd: number;
  premiumClientBrl: number;
  premiumInsurerUsd: number;
  partnerCommissionUsd: number;
  irbUsd: number;
  irbBrl: number;
  resultUsd: number;
  processes: number;
  clients: number;
}

interface RankingData {
  from: string;
  to: string;
  rows: RankingRow[];
  totals: Omit<RankingRow, 'key' | 'label' | 'position'>;
  missingRates: number;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function monthStart() {
  return `${today().slice(0, 8)}01`;
}

function paramsOf(filters: Filters) {
  return {
    from: filters.from || undefined,
    to: filters.to || undefined,
    kind: filters.kind || undefined,
    clientId: filters.clientId ?? undefined,
    partnerId: filters.partnerId ?? undefined,
    insurerId: filters.insurerId ?? undefined,
  };
}

export default function Reports() {
  const { can } = useAuth();
  const tabs = TABS.filter((t) => can(t.permission));
  const [tab, setTab] = useState<Tab>(tabs[0]?.value ?? 'production');
  const [filters, setFilters] = useState<Filters>({
    from: monthStart(),
    to: today(),
    kind: '',
    clientId: null,
    partnerId: null,
    insurerId: null,
  });
  const [exporting, setExporting] = useState(false);

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((current) => ({ ...current, [key]: value }));

  const invalidPeriod = !!filters.from && !!filters.to && filters.from > filters.to;

  async function exportXlsx() {
    setExporting(true);
    try {
      const url = tab === 'production' ? '/reports/production/export' : `/reports/rankings/${tab}/export`;
      await downloadFile(url, paramsOf(filters), 'relatorio.xlsx', 'Não foi possível gerar a planilha.');
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <Page
      wide
      title="Relatórios"
      description="Produção e rankings a partir das averbações definitivas emitidas no período, em dólar."
      actions={
        can('report:export') && (
          <Button variant="outline" loading={exporting} disabled={invalidPeriod} onClick={exportXlsx}>
            <Download className="h-4 w-4" />
            Exportar Excel
          </Button>
        )
      }
    >
      <div className="mb-4 flex items-center gap-1 overflow-x-auto border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={cn(
              '-mb-px whitespace-nowrap border-b-2 px-3.5 py-2 text-[13.5px] font-medium transition-colors',
              tab === t.value
                ? 'border-teal text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mb-4 grid gap-3 rounded-lg border border-border bg-surface p-4 shadow-card sm:grid-cols-2 lg:grid-cols-6">
        <Field label="De" error={invalidPeriod ? 'Data inicial após a final.' : undefined}>
          <Input type="date" value={filters.from} onChange={(e) => set('from', e.target.value)} />
        </Field>
        <Field label="Até">
          <Input type="date" value={filters.to} onChange={(e) => set('to', e.target.value)} />
        </Field>
        <Field label="Tipo">
          <Select value={filters.kind} onChange={(e) => set('kind', e.target.value)}>
            <option value="">Todos</option>
            <option value="IMPORT">Importação</option>
            <option value="EXPORT">Exportação</option>
            <option value="EXTENDED">Prorrogadas</option>
          </Select>
        </Field>
        <Field label="Cliente">
          <Combobox
            endpoint="/companies/options"
            params={{ role: 'CLIENT' }}
            value={filters.clientId}
            placeholder="Todos"
            onChange={(id) => set('clientId', id)}
          />
        </Field>
        <Field label="Parceiro">
          <Combobox
            endpoint="/companies/options"
            params={{ role: 'PARTNER' }}
            value={filters.partnerId}
            placeholder="Todos"
            onChange={(id) => set('partnerId', id)}
          />
        </Field>
        <Field label="Seguradora">
          <Combobox
            endpoint="/companies/options"
            params={{ role: 'INSURER' }}
            value={filters.insurerId}
            placeholder="Todas"
            onChange={(id) => set('insurerId', id)}
          />
        </Field>
      </div>

      {invalidPeriod ? null : tab === 'production' ? (
        <ProductionTable filters={filters} />
      ) : (
        <RankingTable dimension={tab} filters={filters} />
      )}
    </Page>
  );
}

// ---------------------------------------------------------------------------

function MissingRatesNotice({ count }: { count: number }) {
  if (!count) return null;
  return (
    <div className="mb-3 flex items-start gap-2 rounded-md border border-warning/30 bg-warning/8 px-3 py-2 text-[13px] text-foreground">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
      {count} definitiva(s) em moeda diferente do dólar sem câmbio do dia cadastrado — aparecem
      zeradas. Importe a PTAX do período em Cadastros → Câmbio.
    </div>
  );
}

const th = 'px-3 py-2.5 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap';
const td = 'px-3 py-2 text-[13.5px] whitespace-nowrap';
const num = 'tabular text-right';

function ProductionTable({ filters }: { filters: Filters }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['reports', 'production', filters],
    queryFn: async () => {
      const { data } = await api.get('/reports/production', { params: paramsOf(filters) });
      return data as ProductionData;
    },
  });

  if (isLoading) return <Panel><Loading /></Panel>;
  if (isError) return <Panel><LoadError message={errorMessage(error)} /></Panel>;
  if (!data || data.rows.length === 0) {
    return (
      <Panel>
        <EmptyState
          title="Nenhuma definitiva no período"
          description="A planilha lista as averbações definitivas emitidas. Ajuste o período ou os filtros."
        />
      </Panel>
    );
  }

  const t = data.totals;

  return (
    <>
      <MissingRatesNotice count={data.missingRates} />
      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-surface-alt/60">
                <th className={th}>Processo</th>
                <th className={th}>Definitiva</th>
                <th className={th}>Cliente</th>
                <th className={th}>Parceiro</th>
                <th className={cn(th, 'text-right')}>Taxa</th>
                <th className={cn(th, 'text-right')}>Prêmio cli. US$</th>
                <th className={cn(th, 'text-right')}>Prêmio cli. R$</th>
                <th className={cn(th, 'text-right')}>Prêmio seg. US$</th>
                <th className={cn(th, 'text-right')} title="Prêmio da seguradora menos o agravo">
                  A pagar US$
                </th>
                <th className={cn(th, 'text-right')}>A pagar R$</th>
                <th className={cn(th, 'text-right')}>Dif. US$</th>
                <th className={cn(th, 'text-right')}>Dif. R$</th>
                <th className={cn(th, 'text-right')}>Rentab.</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.endorsementNumber} className="border-b border-border last:border-0 hover:bg-surface-alt/50">
                  <td className={td}>
                    <Link to={`/quotes/${r.quoteId}`} className="tabular font-medium text-foreground hover:underline">
                      {r.quoteNumber}
                    </Link>
                    {r.reference && (
                      <span className="block text-[12px] text-muted-foreground">{r.reference}</span>
                    )}
                  </td>
                  <td className={td}>
                    <span className="tabular">{r.endorsementNumber}</span>
                    <span className="block text-[12px] text-muted-foreground">{formatDate(r.issuedAt)}</span>
                  </td>
                  <td className={cn(td, 'max-w-[220px] truncate')} title={r.clientName}>{r.clientName}</td>
                  <td className={cn(td, 'max-w-[180px] truncate text-muted-foreground')} title={r.partnerName ?? ''}>
                    {r.partnerName ?? '—'}
                  </td>
                  <td className={cn(td, num, 'text-muted-foreground')}>{formatMoney(r.brlRate, 4)}</td>
                  <td className={cn(td, num)}>{formatMoney(r.premiumClientUsd)}</td>
                  <td className={cn(td, num, 'text-muted-foreground')}>{formatMoney(r.premiumClientBrl)}</td>
                  <td className={cn(td, num, 'text-muted-foreground')}>{formatMoney(r.premiumInsurerUsd)}</td>
                  <td className={cn(td, num)}>{formatMoney(r.payableUsd)}</td>
                  <td className={cn(td, num, 'text-muted-foreground')}>{formatMoney(r.payableBrl)}</td>
                  <td className={cn(td, num, r.diffUsd < 0 && 'text-danger')}>{formatMoney(r.diffUsd)}</td>
                  <td className={cn(td, num, r.diffBrl < 0 ? 'text-danger' : 'text-muted-foreground')}>
                    {formatMoney(r.diffBrl)}
                  </td>
                  <td className={cn(td, num)}>
                    {r.profitability === null ? '—' : `${formatMoney(r.profitability)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-surface-alt/60 font-semibold">
                <td className={td} colSpan={5}>
                  Total · {t.count} definitiva(s)
                </td>
                <td className={cn(td, num)}>{formatMoney(t.premiumClientUsd)}</td>
                <td className={cn(td, num)}>{formatMoney(t.premiumClientBrl)}</td>
                <td className={cn(td, num)}>{formatMoney(t.premiumInsurerUsd)}</td>
                <td className={cn(td, num)}>{formatMoney(t.payableUsd)}</td>
                <td className={cn(td, num)}>{formatMoney(t.payableBrl)}</td>
                <td className={cn(td, num)}>{formatMoney(t.diffUsd)}</td>
                <td className={cn(td, num)}>{formatMoney(t.diffBrl)}</td>
                <td className={cn(td, num)}>
                  {t.profitability === null ? '—' : `${formatMoney(t.profitability)}%`}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Panel>
    </>
  );
}

/** Colunas de cada ranking, como no legado (docs/18 § A.1–A.3). */
const RANKING_COLUMNS: Record<
  Exclude<Tab, 'production'>,
  { title: string; columns: (keyof RankingRow)[] }
> = {
  client: {
    title: 'Cliente',
    columns: ['percent', 'insuredUsd', 'premiumClientUsd', 'premiumInsurerUsd', 'resultUsd', 'irbUsd', 'processes'],
  },
  partner: {
    title: 'Parceiro',
    columns: ['percent', 'insuredUsd', 'premiumClientUsd', 'irbUsd', 'partnerCommissionUsd', 'resultUsd', 'processes', 'clients'],
  },
  policy: {
    title: 'Apólice',
    columns: ['percent', 'insuredUsd', 'premiumClientUsd', 'premiumClientBrl', 'irbUsd', 'irbBrl', 'processes'],
  },
  state: {
    title: 'Estado',
    columns: ['percent', 'insuredUsd', 'premiumClientUsd', 'premiumClientBrl', 'irbUsd', 'irbBrl', 'processes'],
  },
};

const COLUMN_LABEL: Partial<Record<keyof RankingRow, string>> = {
  percent: '% do prêmio',
  insuredUsd: 'I.S. US$',
  premiumClientUsd: 'Prêmio US$',
  premiumClientBrl: 'Prêmio R$',
  premiumInsurerUsd: 'Prêmio seg. US$',
  partnerCommissionUsd: 'Comissão US$',
  irbUsd: 'IRB US$',
  irbBrl: 'IRB R$',
  resultUsd: 'Resultado US$',
  processes: 'Processos',
  clients: 'Clientes',
};

function cellValue(key: keyof RankingRow, value: number) {
  if (key === 'processes' || key === 'clients') return value.toLocaleString('pt-BR');
  if (key === 'percent') return `${formatMoney(value)}%`;
  return formatMoney(value);
}

function RankingTable({ dimension, filters }: { dimension: Exclude<Tab, 'production'>; filters: Filters }) {
  const config = RANKING_COLUMNS[dimension];
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['reports', 'ranking', dimension, filters],
    queryFn: async () => {
      const { data } = await api.get(`/reports/rankings/${dimension}`, { params: paramsOf(filters) });
      return data as RankingData;
    },
  });

  if (isLoading) return <Panel><Loading /></Panel>;
  if (isError) return <Panel><LoadError message={errorMessage(error)} /></Panel>;
  if (!data || data.rows.length === 0) {
    return (
      <Panel>
        <EmptyState
          title="Nada para ranquear"
          description="Nenhuma definitiva emitida no período com esses filtros."
        />
      </Panel>
    );
  }

  return (
    <>
      <MissingRatesNotice count={data.missingRates} />
      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-surface-alt/60">
                <th className={cn(th, 'w-12 text-right')}>#</th>
                <th className={th}>{config.title}</th>
                {config.columns.map((c) => (
                  <th key={c} className={cn(th, 'text-right')}>
                    {COLUMN_LABEL[c]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.key} className="border-b border-border last:border-0 hover:bg-surface-alt/50">
                  <td className={cn(td, num, 'text-muted-foreground')}>{r.position}</td>
                  <td className={cn(td, 'max-w-[320px] truncate font-medium')} title={r.label}>
                    {r.label}
                  </td>
                  {config.columns.map((c) => (
                    <td
                      key={c}
                      className={cn(
                        td,
                        num,
                        c === 'resultUsd' && (r[c] as number) < 0 && 'text-danger',
                        c === 'percent' && 'text-muted-foreground',
                      )}
                    >
                      {cellValue(c, r[c] as number)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-surface-alt/60 font-semibold">
                <td className={td} colSpan={2}>
                  Total
                </td>
                {config.columns.map((c) => (
                  <td key={c} className={cn(td, num)}>
                    {cellValue(c, data.totals[c as keyof RankingData['totals']] as number)}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </Panel>
    </>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">{children}</div>
  );
}
