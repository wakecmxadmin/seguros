import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download, Lock, Send, TriangleAlert } from 'lucide-react';
import { Page } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Field } from '@/components/ui/field';
import { EmptyState, Loading, LoadError } from '@/components/ui/states';
import { api, errorMessage, tokens } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { useAuth } from '@/stores/auth';
import { cn } from '@/lib/utils';

interface Batch {
  id: string;
  period: string;
  status: 'OPEN' | 'CLOSED' | 'SENT';
  itemCount: number;
  totalInsuredAmount: string;
  totalPremiumInsurer: string;
  closedAt: string | null;
  sentAt: string | null;
  insurer: { id: string; legalName: string; tradeName: string | null };
}

const STATUS = {
  OPEN: { label: 'Aberto', variant: 'warning' as const },
  CLOSED: { label: 'Fechado', variant: 'info' as const },
  SENT: { label: 'Enviado', variant: 'success' as const },
};

/** Competência corrente no formato AAAA-MM. */
function currentPeriod() {
  return new Date().toISOString().slice(0, 7);
}

export default function MonthlyBatches() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [view, setView] = useState<'batches' | 'statement'>('batches');
  const [period, setPeriod] = useState(currentPeriod);
  const [insurerId, setInsurerId] = useState('');

  const { data: insurers } = useQuery({
    queryKey: ['company-options', 'INSURER'],
    queryFn: async () => {
      const { data } = await api.get('/companies/options', { params: { role: 'INSURER' } });
      return data as Array<{ id: string; label: string }>;
    },
  });

  const batchesQuery = useQuery({
    queryKey: ['batches'],
    queryFn: async () => {
      const { data } = await api.get('/batches');
      return data as Batch[];
    },
    enabled: view === 'batches',
  });

  const previewQuery = useQuery({
    queryKey: ['batch-preview', period, insurerId],
    queryFn: async () => {
      const { data } = await api.get('/batches/preview', { params: { period, insurerId } });
      return data as {
        items: any[];
        totals: {
          count: number;
          insuredAmount: number;
          premiumClient: number;
          premiumInsurer: number;
        };
      };
    },
    enabled: view === 'batches' && !!insurerId,
  });

  const statementQuery = useQuery({
    queryKey: ['monthly-statement', period],
    queryFn: async () => {
      const { data } = await api.get('/batches/statement', { params: { period } });
      return data as {
        surchargePercent: number;
        rows: any[];
        totals: {
          count: number;
          premiumOriginal: number;
          surcharge: number;
          premiumWithSurcharge: number;
        };
      };
    },
    enabled: view === 'statement',
  });

  const close = useMutation({
    mutationFn: () => api.post('/batches/close', { period, insurerId }),
    onSuccess: ({ data }) => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['batch-preview'] });
      toast.success(`Competência ${data.period} fechada com ${data.itemCount} averbações.`);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const markSent = useMutation({
    mutationFn: (id: string) => api.patch(`/batches/${id}/sent`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      toast.success('Lote marcado como enviado.');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  /** O download precisa do token, então baixamos via fetch e criamos o blob. */
  async function download(batch: Batch) {
    try {
      const response = await fetch(`/api/batches/${batch.id}/export`, {
        headers: { Authorization: `Bearer ${tokens.access}` },
      });
      if (!response.ok) throw new Error('Falha ao gerar o arquivo.');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `averbacoes-${batch.period}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(errorMessage(error, 'Não foi possível baixar o arquivo.'));
    }
  }

  return (
    <Page
      title="Fechamento mensal"
      description="Lote consolidado enviado à seguradora e extrato do período com o acréscimo aplicado."
      actions={
        <div className="flex items-center gap-1 rounded-md border border-border bg-surface p-0.5">
          {[
            { value: 'batches' as const, label: 'Lotes' },
            { value: 'statement' as const, label: 'Extrato' },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setView(option.value)}
              className={cn(
                'rounded px-3 py-1.5 text-[13px] font-medium transition-colors',
                view === option.value
                  ? 'bg-navy/8 text-navy'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap items-end gap-2.5">
        <Field label="Competência" htmlFor="period" className="w-auto">
          <Input
            id="period"
            type="month"
            className="h-9"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          />
        </Field>

        {view === 'batches' && (
          <>
            <Field label="Seguradora" htmlFor="insurerId" className="w-auto min-w-[220px]">
              <Select
                id="insurerId"
                className="h-9"
                value={insurerId}
                onChange={(e) => setInsurerId(e.target.value)}
              >
                <option value="">Selecione…</option>
                {insurers?.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.label}
                  </option>
                ))}
              </Select>
            </Field>

            {insurerId && (previewQuery.data?.totals.count ?? 0) > 0 && can('endorsement:issue_final') && (
              <Button size="sm" loading={close.isPending} onClick={() => close.mutate()}>
                <Lock className="h-4 w-4" />
                Fechar competência ({previewQuery.data!.totals.count})
              </Button>
            )}
          </>
        )}
      </div>

      {view === 'batches' ? (
        <div className="space-y-5">
          {/* Prévia da competência */}
          {insurerId && (
            <section className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
              <header className="border-b border-border px-4 py-3">
                <h2 className="text-[14px] font-semibold text-foreground">
                  Averbações de {period} ainda não incluídas em lote
                </h2>
              </header>
              {previewQuery.isLoading ? (
                <Loading />
              ) : (previewQuery.data?.items.length ?? 0) === 0 ? (
                <EmptyState
                  title="Nada a fechar nesta competência"
                  description="Todas as averbações do período já estão em algum lote, ou não houve emissão."
                />
              ) : (
                <>
                  <ul className="divide-y divide-border">
                    {previewQuery.data!.items.map((item) => (
                      <li key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                        <span className="tabular w-24 text-[13.5px] font-medium text-foreground">
                          {item.number}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[13.5px] text-muted-foreground">
                          {item.quote.client.tradeName || item.quote.client.legalName}
                        </span>
                        <span className="text-[12.5px] text-muted-foreground">
                          BL {item.blNumber || '—'}
                        </span>
                        <span className="tabular text-[13.5px] text-foreground">
                          {formatMoney(item.insuredAmount)} {item.currency?.code}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface-alt/60 px-4 py-2.5">
                    <span className="text-[13px] font-semibold text-foreground">
                      {previewQuery.data!.totals.count} averbações
                    </span>
                    <span className="tabular text-[13.5px] text-foreground">
                      I.S. {formatMoney(previewQuery.data!.totals.insuredAmount)} · prêmio seguradora{' '}
                      {formatMoney(previewQuery.data!.totals.premiumInsurer)}
                    </span>
                  </footer>
                </>
              )}
            </section>
          )}

          {/* Lotes fechados */}
          <section className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
            <header className="border-b border-border px-4 py-3">
              <h2 className="text-[14px] font-semibold text-foreground">Lotes fechados</h2>
            </header>
            {batchesQuery.isLoading ? (
              <Loading />
            ) : batchesQuery.isError ? (
              <LoadError message={errorMessage(batchesQuery.error)} />
            ) : (batchesQuery.data?.length ?? 0) === 0 ? (
              <EmptyState
                title="Nenhum lote fechado"
                description="Escolha a competência e a seguradora acima para fechar o primeiro."
              />
            ) : (
              <ul className="divide-y divide-border">
                {batchesQuery.data!.map((batch) => (
                  <li key={batch.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <span className="tabular text-[14px] font-medium text-foreground">
                      {batch.period}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13.5px] text-muted-foreground">
                      {batch.insurer.tradeName || batch.insurer.legalName}
                    </span>
                    <span className="text-[13px] text-muted-foreground">
                      {batch.itemCount} averbações
                    </span>
                    <span className="tabular text-[13.5px] text-foreground">
                      {formatMoney(batch.totalPremiumInsurer)}
                    </span>
                    <Badge variant={STATUS[batch.status].variant} dot>
                      {STATUS[batch.status].label}
                    </Badge>
                    <div className="flex items-center gap-1">
                      {can('report:export') && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Baixar arquivo CSV"
                          onClick={() => download(batch)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                      {batch.status === 'CLOSED' && can('endorsement:issue_final') && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Marcar como enviado"
                          onClick={() => markSent.mutate(batch.id)}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
          {statementQuery.isLoading ? (
            <Loading />
          ) : statementQuery.isError ? (
            <LoadError message={errorMessage(statementQuery.error)} />
          ) : (statementQuery.data?.rows.length ?? 0) === 0 ? (
            <EmptyState title="Sem movimento nesta competência" />
          ) : (
            <>
              <div className="flex items-start gap-2.5 border-b border-border bg-warning/6 px-4 py-3">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <p className="text-[13px] leading-relaxed text-foreground">
                  O valor a enviar já inclui o acréscimo de{' '}
                  <strong>{statementQuery.data!.surchargePercent}%</strong>. Enviar a coluna
                  “prêmio original” é erro.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-border bg-surface-alt/60">
                      {['Cliente', 'Averbações', 'Prêmio original', 'Acréscimo', 'Total a enviar'].map(
                        (head) => (
                          <th
                            key={head}
                            className={`px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground ${
                              head !== 'Cliente' ? 'text-right' : ''
                            }`}
                          >
                            {head}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {statementQuery.data!.rows.map((row) => (
                      <tr key={row.clientId} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 text-[14px] font-medium text-foreground">
                          {row.clientName}
                        </td>
                        <td className="tabular px-4 py-3 text-right text-[13.5px] text-muted-foreground">
                          {row.count}
                        </td>
                        <td className="tabular px-4 py-3 text-right text-[13.5px] text-muted-foreground">
                          {formatMoney(row.premiumOriginal)}
                        </td>
                        <td className="tabular px-4 py-3 text-right text-[13.5px] text-warning">
                          +{formatMoney(row.surcharge)}
                        </td>
                        <td className="tabular px-4 py-3 text-right text-[14px] font-semibold text-foreground">
                          {formatMoney(row.premiumWithSurcharge)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border bg-surface-alt/60 font-semibold">
                      <td className="px-4 py-3 text-[13.5px] text-foreground">Total</td>
                      <td className="tabular px-4 py-3 text-right text-[13.5px] text-foreground">
                        {statementQuery.data!.totals.count}
                      </td>
                      <td className="tabular px-4 py-3 text-right text-[13.5px] text-muted-foreground">
                        {formatMoney(statementQuery.data!.totals.premiumOriginal)}
                      </td>
                      <td className="tabular px-4 py-3 text-right text-[13.5px] text-warning">
                        +{formatMoney(statementQuery.data!.totals.surcharge)}
                      </td>
                      <td className="tabular px-4 py-3 text-right text-[15px] text-foreground">
                        {formatMoney(statementQuery.data!.totals.premiumWithSurcharge)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </Page>
  );
}
