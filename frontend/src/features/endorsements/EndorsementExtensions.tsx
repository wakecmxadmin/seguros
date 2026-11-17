import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarPlus, Printer, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { api, errorMessage } from '@/lib/api';
import { formatDate, formatMoney, parseNumber } from '@/lib/format';
import { useAuth } from '@/stores/auth';

export interface Extension {
  id: string;
  sequence: number;
  issuedAt: string;
  coverageUntil: string | null;
  percent: string;
  premiumClient: string;
  premiumInsurer: string;
  premiumClientBrl: string;
  notes: string | null;
  canceledAt: string | null;
  cancelReason: string | null;
}

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Prorrogações de uma definitiva — a "Definitivas em Prorrogação" do legado.
 * Cada prorrogação cobra um percentual do prêmio (20 % por padrão, em
 * Parâmetros) e gera o próprio certificado "PRG-".
 */
export function EndorsementExtensions({
  endorsement,
}: {
  endorsement: {
    id: string;
    number: string;
    position: string;
    premiumClient: string;
    currency?: { code: string } | null;
    quote: { kind: 'IMPORT' | 'EXPORT' };
    extensions?: Extension[];
  };
}) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const extensions = endorsement.extensions ?? [];
  const currency = endorsement.currency?.code ?? '';
  const canceled = endorsement.position === 'CANCELED';

  const [form, setForm] = useState<{ issuedAt: string; coverageUntil: string; percent: string; notes: string } | null>(null);
  const [cancelling, setCancelling] = useState<{ id: string; reason: string } | null>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['endorsement', endorsement.id] });
    queryClient.invalidateQueries({ queryKey: ['endorsements'] });
  };

  const issue = useMutation({
    mutationFn: () =>
      api.post(`/endorsements/${endorsement.id}/extensions`, {
        issuedAt: form!.issuedAt || undefined,
        coverageUntil: form!.coverageUntil || undefined,
        percent: form!.percent.trim() ? parseNumber(form!.percent) : undefined,
        notes: form!.notes.trim() || undefined,
      }),
    onSuccess: () => {
      refresh();
      toast.success('Prorrogação emitida.');
      setForm(null);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const cancel = useMutation({
    mutationFn: () =>
      api.patch(`/endorsements/${endorsement.id}/extensions/${cancelling!.id}/cancel`, {
        reason: cancelling!.reason,
      }),
    onSuccess: () => {
      refresh();
      toast.success('Prorrogação cancelada.');
      setCancelling(null);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (!extensions.length && (canceled || !can('endorsement:issue_final'))) return null;

  const typedPercent = form?.percent.trim() ? parseNumber(form.percent) : NaN;
  const preview = Number.isFinite(typedPercent)
    ? Math.round(Number(endorsement.premiumClient) * typedPercent) / 100
    : null;

  return (
    <>
      <div className="mb-2.5 mt-6 flex items-center justify-between">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Prorrogações</p>
        {!canceled && !form && can('endorsement:issue_final') && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setForm({ issuedAt: today(), coverageUntil: '', percent: '', notes: '' })}
          >
            <CalendarPlus className="h-4 w-4" />
            Prorrogar
          </Button>
        )}
      </div>

      {extensions.length > 0 && (
        <ul className="divide-y divide-border rounded-md border border-border">
          {extensions.map((x) => (
            <li key={x.id} className="px-3.5 py-2.5">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="tabular text-[13.5px] font-medium text-foreground">PRG-{x.sequence}</span>
                <span className="text-[13px] text-muted-foreground">{formatDate(x.issuedAt)}</span>
                {x.coverageUntil && (
                  <span className="text-[13px] text-muted-foreground">até {formatDate(x.coverageUntil)}</span>
                )}
                <span className="text-[13px] text-muted-foreground">{Number(x.percent).toLocaleString('pt-BR')}%</span>
                <span className="tabular ml-auto text-[13.5px] text-foreground">
                  {formatMoney(x.premiumClient)} {currency}
                </span>
                {x.canceledAt ? (
                  <Badge variant="danger">Cancelada</Badge>
                ) : (
                  <span className="flex gap-1">
                    {can('document:generate') && (
                      <Button
                        size="sm"
                        variant="ghost"
                        title={endorsement.quote.kind === 'EXPORT' ? 'Solicitação de cobertura' : 'Certificado'}
                        onClick={() =>
                          window.open(`/print/endorsements/${endorsement.id}?extension=${x.id}`, '_blank', 'noopener')
                        }
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                    )}
                    {can('endorsement:change_position') && (
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Cancelar prorrogação"
                        onClick={() => setCancelling({ id: x.id, reason: '' })}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </span>
                )}
              </div>
              {(x.notes || x.cancelReason) && (
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  {x.cancelReason ? `Cancelada: ${x.cancelReason}` : x.notes}
                </p>
              )}
              {cancelling?.id === x.id && (
                <div className="mt-2 flex gap-2">
                  <Input
                    autoFocus
                    placeholder="Motivo do cancelamento"
                    value={cancelling.reason}
                    onChange={(e) => setCancelling({ ...cancelling, reason: e.target.value })}
                  />
                  <Button
                    size="sm"
                    variant="danger"
                    loading={cancel.isPending}
                    disabled={cancelling.reason.trim().length < 3}
                    onClick={() => cancel.mutate()}
                  >
                    Cancelar prorrogação
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setCancelling(null)}>
                    Voltar
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {form && (
        <div className="mt-2 rounded-md border border-border bg-surface-alt p-3.5">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Data da prorrogação" htmlFor="ext-issued">
              <Input
                id="ext-issued"
                type="date"
                value={form.issuedAt}
                onChange={(e) => setForm({ ...form, issuedAt: e.target.value })}
              />
            </Field>
            <Field label="Cobertura até" htmlFor="ext-until" hint="Opcional.">
              <Input
                id="ext-until"
                type="date"
                value={form.coverageUntil}
                onChange={(e) => setForm({ ...form, coverageUntil: e.target.value })}
              />
            </Field>
            <Field label="Percentual (%)" htmlFor="ext-percent" hint="Vazio usa o dos Parâmetros.">
              <Input
                id="ext-percent"
                inputMode="decimal"
                className="tabular text-right"
                placeholder="padrão"
                value={form.percent}
                onChange={(e) => setForm({ ...form, percent: e.target.value })}
              />
            </Field>
            <Field label="Observação" htmlFor="ext-notes" className="sm:col-span-3">
              <Input
                id="ext-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-[12.5px] text-muted-foreground">
              {preview !== null
                ? `Prêmio da prorrogação: ${formatMoney(preview)} ${currency}`
                : `Cobra o percentual dos Parâmetros sobre o prêmio de ${formatMoney(endorsement.premiumClient)} ${currency}.`}
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setForm(null)}>
                Cancelar
              </Button>
              <Button size="sm" loading={issue.isPending} onClick={() => issue.mutate()}>
                Emitir prorrogação
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
