import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Banknote, FileText, LayoutList, Table2 } from 'lucide-react';
import { Page } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Field } from '@/components/ui/field';
import { EmptyState, Loading, LoadError } from '@/components/ui/states';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from '@/components/ui/dialog';
import { api, errorMessage } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/format';
import { useAuth } from '@/stores/auth';
import { cn } from '@/lib/utils';

interface Commission {
  id: string;
  beneficiary: 'PARTNER' | 'BROKER' | 'SALESPERSON';
  status: 'PENDING' | 'INVOICE_REQUESTED' | 'PAID' | 'CANCELED';
  premiumBase: string;
  percent: string;
  amount: string;
  amountBrl: string;
  invoiceNumber: string | null;
  paymentDate: string | null;
  currency: { code: string } | null;
  company: { id: string; legalName: string; tradeName: string | null } | null;
  employee: { id: string; name: string } | null;
  endorsement: {
    number: string;
    quote: { number: number; client: { legalName: string; tradeName: string | null } };
  };
}

interface StatementRow {
  key: string;
  beneficiary: string;
  name: string;
  count: number;
  amount: number;
  amountBrl: number;
  pending: number;
  paid: number;
}

const BENEFICIARY = { PARTNER: 'Parceiro', BROKER: 'Corretora', SALESPERSON: 'Vendedor' };

const STATUS = {
  PENDING: { label: 'Em aberto', variant: 'warning' as const },
  INVOICE_REQUESTED: { label: 'NF solicitada', variant: 'info' as const },
  PAID: { label: 'Paga', variant: 'success' as const },
  CANCELED: { label: 'Cancelada', variant: 'neutral' as const },
};

/** Nome do favorecido, seja empresa, funcionário ou a própria corretora. */
function beneficiaryName(commission: Commission) {
  return (
    commission.company?.tradeName ??
    commission.company?.legalName ??
    commission.employee?.name ??
    'Corretora'
  );
}

export default function Commissions() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [view, setView] = useState<'list' | 'statement'>('list');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [paying, setPaying] = useState(false);

  const listQuery = useQuery({
    queryKey: ['commissions', status],
    queryFn: async () => {
      const { data } = await api.get('/commissions', {
        params: { ...(status ? { status } : {}), perPage: 100 },
      });
      return data as {
        items: Commission[];
        total: number;
        totals: { amount: number; amountBrl: number };
      };
    },
    enabled: view === 'list',
  });

  const statementQuery = useQuery({
    queryKey: ['commission-statement', status],
    queryFn: async () => {
      const { data } = await api.get('/commissions/statement', {
        params: status ? { status } : undefined,
      });
      return data as {
        rows: StatementRow[];
        totals: { count: number; amount: number; amountBrl: number; pending: number; paid: number };
      };
    },
    enabled: view === 'statement',
  });

  const requestInvoice = useMutation({
    mutationFn: (ids: string[]) => api.post('/commissions/request-invoice', { ids }),
    onSuccess: ({ data }) => {
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
      setSelected(new Set());
      toast.success(`Nota fiscal solicitada para ${data.count} comissão(ões).`);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const items = listQuery.data?.items ?? [];
  const selectable = items.filter((i) => i.status === 'PENDING' || i.status === 'INVOICE_REQUESTED');
  const allSelected = selectable.length > 0 && selectable.every((i) => selected.has(i.id));

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <Page
      title="Comissões"
      description="Rateio do prêmio entre parceiro, corretora e vendedor — a “intermediação de negócios” do sistema antigo."
      actions={
        <div className="flex items-center gap-1 rounded-md border border-border bg-surface p-0.5">
          {[
            { value: 'list' as const, label: 'Lançamentos', icon: LayoutList },
            { value: 'statement' as const, label: 'Extrato', icon: Table2 },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setView(option.value)}
              className={cn(
                'flex items-center gap-1.5 rounded px-3 py-1.5 text-[13px] font-medium transition-colors',
                view === option.value
                  ? 'bg-navy/8 text-navy'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <option.icon className="h-3.5 w-3.5" />
              {option.label}
            </button>
          ))}
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-1 rounded-md border border-border bg-surface p-0.5">
          {[
            { value: '', label: 'Todas' },
            { value: 'PENDING', label: 'Em aberto' },
            { value: 'INVOICE_REQUESTED', label: 'NF solicitada' },
            { value: 'PAID', label: 'Pagas' },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setStatus(option.value)}
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

        {view === 'list' && selected.size > 0 && can('commission:pay') && (
          <>
            <Button
              size="sm"
              variant="outline"
              loading={requestInvoice.isPending}
              onClick={() => requestInvoice.mutate([...selected])}
            >
              <FileText className="h-4 w-4" />
              Solicitar NF ({selected.size})
            </Button>
            <Button size="sm" onClick={() => setPaying(true)}>
              <Banknote className="h-4 w-4" />
              Pagar ({selected.size})
            </Button>
          </>
        )}
      </div>

      {view === 'list' ? (
        <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
          {listQuery.isLoading ? (
            <Loading />
          ) : listQuery.isError ? (
            <LoadError message={errorMessage(listQuery.error)} />
          ) : items.length === 0 ? (
            <EmptyState
              title="Nenhuma comissão"
              description="As comissões são geradas automaticamente quando uma definitiva é emitida."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border bg-surface-alt/60">
                    <th className="w-10 px-3 py-2.5">
                      {selectable.length > 0 && (
                        <input
                          type="checkbox"
                          checked={allSelected}
                          aria-label="Selecionar todas"
                          onChange={() =>
                            setSelected(
                              allSelected ? new Set() : new Set(selectable.map((i) => i.id)),
                            )
                          }
                          className="h-4 w-4 rounded border-border-strong text-teal focus:ring-2 focus:ring-ring/40"
                        />
                      )}
                    </th>
                    {['Favorecido', 'Averbação', 'Base', '%', 'Comissão', 'Status'].map((head) => (
                      <th
                        key={head}
                        className={`px-3 py-2.5 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground ${
                          ['Base', '%', 'Comissão'].includes(head) ? 'text-right' : ''
                        }`}
                      >
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-border transition-colors last:border-0 hover:bg-surface-alt/50"
                    >
                      <td className="px-3 py-2.5">
                        {(row.status === 'PENDING' || row.status === 'INVOICE_REQUESTED') && (
                          <input
                            type="checkbox"
                            checked={selected.has(row.id)}
                            onChange={() => toggle(row.id)}
                            aria-label={`Selecionar comissão de ${beneficiaryName(row)}`}
                            className="h-4 w-4 rounded border-border-strong text-teal focus:ring-2 focus:ring-ring/40"
                          />
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="block text-[13.5px] font-medium text-foreground">
                          {beneficiaryName(row)}
                        </span>
                        <span className="block text-[12px] text-muted-foreground">
                          {BENEFICIARY[row.beneficiary]}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="tabular block text-[13.5px] text-foreground">
                          {row.endorsement.number}
                        </span>
                        <span className="block text-[12px] text-muted-foreground">
                          {row.endorsement.quote.client.tradeName ||
                            row.endorsement.quote.client.legalName}
                        </span>
                      </td>
                      <td className="tabular px-3 py-2.5 text-right text-[13.5px] text-muted-foreground">
                        {formatMoney(row.premiumBase)}
                      </td>
                      <td className="tabular px-3 py-2.5 text-right text-[13.5px] text-muted-foreground">
                        {Number(row.percent).toFixed(2)}
                      </td>
                      <td className="tabular px-3 py-2.5 text-right text-[13.5px] font-medium text-foreground">
                        {formatMoney(row.amount)} {row.currency?.code}
                        <span className="block text-[12px] font-normal text-muted-foreground">
                          R$ {formatMoney(row.amountBrl)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge variant={STATUS[row.status].variant} dot>
                          {STATUS[row.status].label}
                        </Badge>
                        {row.invoiceNumber && (
                          <span className="mt-0.5 block text-[12px] text-muted-foreground">
                            {row.invoiceNumber}
                          </span>
                        )}
                        {row.paymentDate && (
                          <span className="tabular mt-0.5 block text-[12px] text-muted-foreground">
                            {formatDate(row.paymentDate)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {listQuery.data && (
                  <tfoot>
                    <tr className="border-t border-border bg-surface-alt/60">
                      <td colSpan={5} className="px-3 py-2.5 text-[13px] font-semibold text-foreground">
                        Total
                      </td>
                      <td className="tabular px-3 py-2.5 text-right text-[13.5px] font-semibold text-foreground">
                        {formatMoney(listQuery.data.totals.amount)}
                        <span className="block text-[12px] font-normal text-muted-foreground">
                          R$ {formatMoney(listQuery.data.totals.amountBrl)}
                        </span>
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
          {statementQuery.isLoading ? (
            <Loading />
          ) : statementQuery.isError ? (
            <LoadError message={errorMessage(statementQuery.error)} />
          ) : (statementQuery.data?.rows.length ?? 0) === 0 ? (
            <EmptyState title="Sem comissões no período" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border bg-surface-alt/60">
                    {['Favorecido', 'Tipo', 'Lançamentos', 'Total', 'Pago', 'Em aberto'].map(
                      (head) => (
                        <th
                          key={head}
                          className={`px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground ${
                            ['Lançamentos', 'Total', 'Pago', 'Em aberto'].includes(head)
                              ? 'text-right'
                              : ''
                          }`}
                        >
                          {head}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {statementQuery.data?.rows.map((row) => (
                    <tr key={row.key} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 text-[14px] font-medium text-foreground">
                        {row.name}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-muted-foreground">
                        {BENEFICIARY[row.beneficiary as keyof typeof BENEFICIARY]}
                      </td>
                      <td className="tabular px-4 py-3 text-right text-[13.5px] text-muted-foreground">
                        {row.count}
                      </td>
                      <td className="tabular px-4 py-3 text-right text-[13.5px] font-medium text-foreground">
                        {formatMoney(row.amount)}
                        <span className="block text-[12px] font-normal text-muted-foreground">
                          R$ {formatMoney(row.amountBrl)}
                        </span>
                      </td>
                      <td className="tabular px-4 py-3 text-right text-[13.5px] text-success">
                        {formatMoney(row.paid)}
                      </td>
                      <td className="tabular px-4 py-3 text-right text-[13.5px] text-warning">
                        {formatMoney(row.pending)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {statementQuery.data && (
                  <tfoot>
                    <tr className="border-t border-border bg-surface-alt/60 font-semibold">
                      <td colSpan={2} className="px-4 py-3 text-[13.5px] text-foreground">
                        Total
                      </td>
                      <td className="tabular px-4 py-3 text-right text-[13.5px] text-foreground">
                        {statementQuery.data.totals.count}
                      </td>
                      <td className="tabular px-4 py-3 text-right text-[13.5px] text-foreground">
                        {formatMoney(statementQuery.data.totals.amount)}
                      </td>
                      <td className="tabular px-4 py-3 text-right text-[13.5px] text-success">
                        {formatMoney(statementQuery.data.totals.paid)}
                      </td>
                      <td className="tabular px-4 py-3 text-right text-[13.5px] text-warning">
                        {formatMoney(statementQuery.data.totals.pending)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>
      )}

      {paying && (
        <PayDialog
          ids={[...selected]}
          onClose={() => setPaying(false)}
          onPaid={() => {
            queryClient.invalidateQueries({ queryKey: ['commissions'] });
            queryClient.invalidateQueries({ queryKey: ['commission-statement'] });
            setSelected(new Set());
          }}
        />
      )}
    </Page>
  );
}

function PayDialog({
  ids,
  onClose,
  onPaid,
}: {
  ids: string[];
  onClose: () => void;
  onPaid: () => void;
}) {
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [invoiceNumber, setInvoiceNumber] = useState('');

  const pay = useMutation({
    mutationFn: () =>
      api.post('/commissions/pay', {
        ids,
        paymentDate,
        invoiceNumber: invoiceNumber || undefined,
      }),
    onSuccess: ({ data }) => {
      toast.success(`${data.count} comissão(ões) marcada(s) como paga(s).`);
      onPaid();
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader
          title="Registrar pagamento"
          description={`${ids.length} comissão(ões) selecionada(s).`}
        />
        <DialogBody>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Data do pagamento" htmlFor="paymentDate">
              <Input
                id="paymentDate"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </Field>
            <Field label="Nota fiscal" htmlFor="invoiceNumber">
              <Input
                id="invoiceNumber"
                placeholder="NF-0000"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
              />
            </Field>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button loading={pay.isPending} onClick={() => pay.mutate()}>
            Confirmar pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
