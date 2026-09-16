import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Ban, Check, Plus, Search, Send } from 'lucide-react';
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
import { formatDate, formatMoney, parseNumber } from '@/lib/format';
import { useAuth } from '@/stores/auth';

interface CashRequest {
  id: string;
  version: number;
  status: 'PENDING_SEND' | 'SENT' | 'RECEIVED' | 'CANCELED';
  premiumInsurer: string;
  surchargePercent: string;
  surchargeAmount: string;
  amount: string;
  amountBrl: string;
  receivedAmountBrl: string | null;
  chargeDate: string | null;
  sentAt: string | null;
  paymentDate: string | null;
  currency: { code: string } | null;
  endorsement: {
    id: string;
    number: string;
    quote: {
      number: number;
      client: { legalName: string; tradeName: string | null };
      partner: { legalName: string; tradeName: string | null } | null;
      insurer: { legalName: string; tradeName: string | null } | null;
    };
  };
}

interface PendingEndorsement {
  id: string;
  number: string;
  premiumInsurer: string;
  insuredAmount: string;
  currency: { code: string } | null;
  quote: {
    number: number;
    client: { legalName: string; tradeName: string | null };
    insurer: { legalName: string; tradeName: string | null } | null;
  };
}

const STATUS = {
  PENDING_SEND: { label: 'Falta enviar', variant: 'warning' as const },
  SENT: { label: 'Enviado', variant: 'info' as const },
  RECEIVED: { label: 'Recebido', variant: 'success' as const },
  CANCELED: { label: 'Cancelado', variant: 'neutral' as const },
};

export default function CashRequests() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [settling, setSettling] = useState<CashRequest | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['cash-requests', search, status],
    queryFn: async () => {
      const { data } = await api.get('/cash-requests', {
        params: { ...(search ? { search } : {}), ...(status ? { status } : {}), perPage: 100 },
      });
      return data as {
        items: CashRequest[];
        total: number;
        totals: { amount: number; amountBrl: number };
      };
    },
  });

  const { data: pending } = useQuery({
    queryKey: ['pending-endorsements'],
    queryFn: async () => {
      const { data } = await api.get('/cash-requests/pending-endorsements');
      return data as PendingEndorsement[];
    },
  });

  const send = useMutation({
    mutationFn: (ids: string[]) => api.post('/cash-requests/send', { ids }),
    onSuccess: ({ data }) => {
      queryClient.invalidateQueries({ queryKey: ['cash-requests'] });
      setSelected(new Set());
      toast.success(`${data.count} numerário(s) enviado(s) à seguradora.`);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => api.patch(`/cash-requests/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-requests'] });
      queryClient.invalidateQueries({ queryKey: ['pending-endorsements'] });
      toast.success('Numerário cancelado.');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const items = data?.items ?? [];
  const selectable = items.filter((i) => i.status === 'PENDING_SEND');
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
      title="Numerário"
      description="Valor devido à seguradora por averbação definitiva, com o agravo aplicado."
      actions={
        can('cash_request:create') &&
        (pending?.length ?? 0) > 0 && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            Solicitar ({pending!.length})
          </Button>
        )
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[240px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por averbação ou cliente"
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-1 rounded-md border border-border bg-surface p-0.5">
          {[
            { value: '', label: 'Todos' },
            { value: 'PENDING_SEND', label: 'Falta enviar' },
            { value: 'SENT', label: 'Enviados' },
            { value: 'RECEIVED', label: 'Recebidos' },
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

        {selected.size > 0 && can('cash_request:create') && (
          <Button size="sm" loading={send.isPending} onClick={() => send.mutate([...selected])}>
            <Send className="h-4 w-4" />
            Enviar {selected.size} à seguradora
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
        {isLoading ? (
          <Loading />
        ) : isError ? (
          <LoadError message={errorMessage(error)} />
        ) : items.length === 0 ? (
          <EmptyState
            title="Nenhum numerário"
            description={
              search || status
                ? 'Ajuste a busca ou os filtros.'
                : 'Solicite o numerário das averbações definitivas emitidas.'
            }
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
                        aria-label="Selecionar todos"
                        onChange={() =>
                          setSelected(allSelected ? new Set() : new Set(selectable.map((i) => i.id)))
                        }
                        className="h-4 w-4 rounded border-border-strong text-teal focus:ring-2 focus:ring-ring/40"
                      />
                    )}
                  </th>
                  {['Averbação', 'Cliente', 'Prêmio seg.', 'Agravo', 'A pagar', 'Status', ''].map(
                    (head, i) => (
                      <th
                        key={head || i}
                        className={`px-3 py-2.5 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground ${
                          ['Prêmio seg.', 'Agravo', 'A pagar'].includes(head) ? 'text-right' : ''
                        }`}
                      >
                        {head}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border transition-colors last:border-0 hover:bg-surface-alt/50"
                  >
                    <td className="px-3 py-2.5">
                      {row.status === 'PENDING_SEND' && (
                        <input
                          type="checkbox"
                          checked={selected.has(row.id)}
                          onChange={() => toggle(row.id)}
                          aria-label={`Selecionar ${row.endorsement.number}`}
                          className="h-4 w-4 rounded border-border-strong text-teal focus:ring-2 focus:ring-ring/40"
                        />
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="tabular block text-[13.5px] font-medium text-foreground">
                        {row.endorsement.number}
                      </span>
                      <span className="block text-[12px] text-muted-foreground">
                        proc. {row.endorsement.quote.number} · v{row.version}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[13.5px] text-foreground">
                      {row.endorsement.quote.client.tradeName ||
                        row.endorsement.quote.client.legalName}
                    </td>
                    <td className="tabular px-3 py-2.5 text-right text-[13.5px] text-muted-foreground">
                      {formatMoney(row.premiumInsurer)}
                    </td>
                    <td className="tabular px-3 py-2.5 text-right text-[13.5px] text-muted-foreground">
                      {Number(row.surchargeAmount) > 0
                        ? `+${formatMoney(row.surchargeAmount)} (${Number(row.surchargePercent).toFixed(0)}%)`
                        : '—'}
                    </td>
                    <td className="tabular px-3 py-2.5 text-right text-[13.5px] font-medium text-foreground">
                      {formatMoney(row.amount)} {row.currency?.code}
                      <span className="block text-[12px] font-normal text-muted-foreground">
                        R$ {formatMoney(row.receivedAmountBrl ?? row.amountBrl)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant={STATUS[row.status].variant} dot>
                        {STATUS[row.status].label}
                      </Badge>
                      {row.paymentDate && (
                        <span className="tabular mt-0.5 block text-[12px] text-muted-foreground">
                          {formatDate(row.paymentDate)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-0.5">
                        {can('cash_request:settle') && row.status === 'SENT' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Dar baixa"
                            onClick={() => setSettling(row)}
                          >
                            <Check className="h-4 w-4 text-success" />
                          </Button>
                        )}
                        {can('cash_request:settle') &&
                          row.status !== 'RECEIVED' &&
                          row.status !== 'CANCELED' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Cancelar numerário"
                              onClick={() => cancel.mutate(row.id)}
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {data && items.length > 0 && (
                <tfoot>
                  <tr className="border-t border-border bg-surface-alt/60">
                    <td colSpan={5} className="px-3 py-2.5 text-[13px] font-semibold text-foreground">
                      Total do filtro
                    </td>
                    <td className="tabular px-3 py-2.5 text-right text-[13.5px] font-semibold text-foreground">
                      {formatMoney(data.totals.amount)}
                      <span className="block text-[12px] font-normal text-muted-foreground">
                        R$ {formatMoney(data.totals.amountBrl)}
                      </span>
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {creating && pending && (
        <CreateCashRequestDialog
          endorsements={pending}
          onClose={() => setCreating(false)}
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: ['cash-requests'] });
            queryClient.invalidateQueries({ queryKey: ['pending-endorsements'] });
          }}
        />
      )}

      {settling && (
        <SettleDialog
          request={settling}
          onClose={() => setSettling(null)}
          onSettled={() => queryClient.invalidateQueries({ queryKey: ['cash-requests'] })}
        />
      )}
    </Page>
  );
}

function CreateCashRequestDialog({
  endorsements,
  onClose,
  onCreated,
}: {
  endorsements: PendingEndorsement[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [endorsementId, setEndorsementId] = useState(endorsements[0]?.id ?? '');
  const [surcharge, setSurcharge] = useState('0,00');

  const selected = endorsements.find((e) => e.id === endorsementId);
  const premium = Number(selected?.premiumInsurer ?? 0);
  const percent = parseNumber(surcharge);
  const total = premium + (premium * percent) / 100;

  const create = useMutation({
    mutationFn: () =>
      api.post('/cash-requests', { endorsementId, surchargePercent: percent }),
    onSuccess: () => {
      toast.success('Numerário solicitado.');
      onCreated();
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader
          title="Solicitar numerário"
          description="Valor a pagar à seguradora pela averbação definitiva."
        />
        <DialogBody>
          <Field label="Averbação definitiva" htmlFor="endorsementId" required>
            <select
              id="endorsementId"
              value={endorsementId}
              onChange={(e) => setEndorsementId(e.target.value)}
              className="h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-base text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40"
            >
              {endorsements.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.number} — {e.quote.client.tradeName || e.quote.client.legalName} ·{' '}
                  {formatMoney(e.premiumInsurer)} {e.currency?.code}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Agravo (%)"
            htmlFor="surcharge"
            className="mt-4"
            hint="Acréscimo sobre o valor devido. A confirmar com o cliente: 20% ou 25%."
          >
            <Input
              id="surcharge"
              className="tabular text-right"
              inputMode="decimal"
              value={surcharge}
              onChange={(e) => setSurcharge(e.target.value)}
            />
          </Field>

          <div className="mt-5 rounded-md border border-border bg-surface-alt/50 px-4 py-3">
            <dl className="space-y-1.5 text-[13.5px]">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Prêmio da seguradora</dt>
                <dd className="tabular text-foreground">{formatMoney(premium)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Agravo ({percent.toFixed(0)}%)</dt>
                <dd className="tabular text-foreground">
                  +{formatMoney((premium * percent) / 100)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-border pt-1.5 font-semibold">
                <dt className="text-foreground">Total a pagar</dt>
                <dd className="tabular text-foreground">
                  {formatMoney(total)} {selected?.currency?.code}
                </dd>
              </div>
            </dl>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button loading={create.isPending} onClick={() => create.mutate()}>
            Solicitar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SettleDialog({
  request,
  onClose,
  onSettled,
}: {
  request: CashRequest;
  onClose: () => void;
  onSettled: () => void;
}) {
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState(formatMoney(request.amountBrl));

  const settle = useMutation({
    mutationFn: () =>
      api.patch(`/cash-requests/${request.id}/settle`, {
        paymentDate,
        receivedAmountBrl: parseNumber(amount),
      }),
    onSuccess: () => {
      toast.success('Baixa registrada.');
      onSettled();
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader
          title="Dar baixa"
          description={`Averbação ${request.endorsement.number}`}
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
            <Field
              label="Valor recebido (R$)"
              htmlFor="receivedAmount"
              hint="Ajuste se diferir do calculado."
            >
              <Input
                id="receivedAmount"
                className="tabular text-right"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button loading={settle.isPending} onClick={() => settle.mutate()}>
            Confirmar baixa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
