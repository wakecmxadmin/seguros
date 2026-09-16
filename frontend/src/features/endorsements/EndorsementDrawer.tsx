import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Anchor, FilePlus2, History, Ship } from 'lucide-react';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Field } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { Loading, LoadError } from '@/components/ui/states';
import { api, errorMessage } from '@/lib/api';
import { formatDate, formatMoney, parseNumber } from '@/lib/format';
import { formatDateTime } from '@/lib/utils';
import { useAuth } from '@/stores/auth';
import { POSITION_LABEL, TYPE_LABEL } from './EndorsementList';

interface EndorsementDrawerProps {
  id: string;
  onClose: () => void;
}

export function EndorsementDrawer({ id, onClose }: EndorsementDrawerProps) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [issuingFinal, setIssuingFinal] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['endorsement', id],
    queryFn: async () => {
      const { data } = await api.get(`/endorsements/${id}`);
      return data;
    },
  });

  const changePosition = useMutation({
    mutationFn: (position: string) =>
      api.patch(`/endorsements/${id}/position`, {
        position,
        ...(position === 'CANCELED' ? { reason: 'Cancelada pela operação' } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['endorsement', id] });
      queryClient.invalidateQueries({ queryKey: ['endorsements'] });
      toast.success('Posição atualizada.');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const currency = data?.currency?.code ?? '';
  const isProvisional = data?.type === 'PROVISIONAL';
  const hasBalance = Number(data?.balance ?? 0) > 0;

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-3xl">
          {isLoading ? (
            <DialogBody>
              <Loading />
            </DialogBody>
          ) : isError ? (
            <DialogBody>
              <LoadError message={errorMessage(error)} />
            </DialogBody>
          ) : (
            <>
              <DialogHeader
                title={`Averbação ${data.number}`}
                description={`Processo ${data.quote.number} · ${data.quote.client.tradeName || data.quote.client.legalName}`}
              />

              <DialogBody>
                <div className="mb-5 flex flex-wrap items-center gap-2">
                  <Badge variant={isProvisional ? 'provisional' : 'final'} dot>
                    {TYPE_LABEL[data.type as keyof typeof TYPE_LABEL]}
                  </Badge>
                  <Badge variant="neutral">
                    {POSITION_LABEL[data.position as keyof typeof POSITION_LABEL]}
                  </Badge>
                  {data.parent && (
                    <span className="text-[13px] text-muted-foreground">
                      emitida sobre {data.parent.number}
                    </span>
                  )}
                </div>

                {/* Valores */}
                <div className="grid gap-3 sm:grid-cols-4">
                  <Metric label="Importância segurada" value={formatMoney(data.insuredAmount)} suffix={currency} />
                  <Metric label="Prêmio cliente" value={formatMoney(data.premiumClient)} suffix={currency} />
                  <Metric label="Custo seguradora" value={formatMoney(data.premiumInsurer)} suffix={currency} />
                  {isProvisional ? (
                    <Metric
                      label="Saldo disponível"
                      value={formatMoney(data.balance)}
                      suffix={`${Number(data.balancePercent).toFixed(0)}%`}
                      highlight={hasBalance}
                    />
                  ) : (
                    <Metric label="Em reais" value={`R$ ${formatMoney(data.premiumClientBrl)}`} />
                  )}
                </div>

                {/* Embarque */}
                <SectionTitle>Embarque</SectionTitle>
                <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                  <Row label="Data de emissão" value={formatDate(data.issuedAt)} />
                  <Row
                    label="Atracação"
                    value={data.berthingDate ? formatDate(data.berthingDate) : 'não informada'}
                    icon={<Anchor className="h-3.5 w-3.5" />}
                  />
                  <Row label="Conhecimento (BL/AWB)" value={data.blNumber || '—'} />
                  <Row label="Container" value={data.containerNumber || '—'} />
                  <Row
                    label="Navio"
                    value={data.vessel?.name || '—'}
                    icon={<Ship className="h-3.5 w-3.5" />}
                  />
                  <Row label="Seguradora" value={data.quote.insurer?.tradeName || data.quote.insurer?.legalName || '—'} />
                </dl>

                {/* Definitivas emitidas */}
                {isProvisional && data.children?.length > 0 && (
                  <>
                    <SectionTitle>Definitivas emitidas</SectionTitle>
                    <ul className="divide-y divide-border rounded-md border border-border">
                      {data.children.map((child: any) => (
                        <li key={child.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                          <span className="tabular text-[13.5px] font-medium text-foreground">
                            {child.number}
                          </span>
                          <span className="text-[13px] text-muted-foreground">
                            {formatDate(child.issuedAt)}
                          </span>
                          <span className="tabular text-[13.5px] text-foreground">
                            {formatMoney(child.insuredAmount)} {currency}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {/* Comissões */}
                {data.commissions?.length > 0 && (
                  <>
                    <SectionTitle>Comissões geradas</SectionTitle>
                    <ul className="divide-y divide-border rounded-md border border-border">
                      {data.commissions.map((commission: any) => (
                        <li
                          key={commission.id}
                          className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                        >
                          <span className="text-[13.5px] text-foreground">
                            {commission.company?.tradeName ??
                              commission.company?.legalName ??
                              commission.employee?.name ??
                              'Corretora'}
                          </span>
                          <span className="text-[13px] text-muted-foreground">
                            {Number(commission.percent).toFixed(2)}%
                          </span>
                          <span className="tabular text-[13.5px] text-foreground">
                            {formatMoney(commission.amount)} {currency}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {/* Histórico */}
                {data.positionHistory?.length > 0 && (
                  <>
                    <SectionTitle>
                      <History className="mr-1.5 inline h-3.5 w-3.5" />
                      Histórico de posição
                    </SectionTitle>
                    <ul className="space-y-1.5">
                      {data.positionHistory.map((log: any) => (
                        <li key={log.id} className="text-[13px] text-muted-foreground">
                          <span className="tabular">{formatDateTime(log.createdAt)}</span> ·{' '}
                          {log.from
                            ? `${POSITION_LABEL[log.from as keyof typeof POSITION_LABEL]} → `
                            : ''}
                          <span className="text-foreground">
                            {POSITION_LABEL[log.to as keyof typeof POSITION_LABEL]}
                          </span>
                          {log.reason && ` — ${log.reason}`}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </DialogBody>

              <DialogFooter>
                {can('endorsement:change_position') && data.position !== 'CANCELED' && (
                  <Select
                    className="mr-auto h-9 w-auto min-w-[180px]"
                    value=""
                    onChange={(e) => e.target.value && changePosition.mutate(e.target.value)}
                  >
                    <option value="">Alterar posição…</option>
                    {['PENDING', 'FOLLOW_UP', 'SETTLED', 'CANCELED']
                      .filter((p) => p !== data.position)
                      .map((p) => (
                        <option key={p} value={p}>
                          {POSITION_LABEL[p as keyof typeof POSITION_LABEL]}
                        </option>
                      ))}
                  </Select>
                )}

                {isProvisional && hasBalance && can('endorsement:issue_final') && (
                  <Button onClick={() => setIssuingFinal(true)}>
                    <FilePlus2 className="h-4 w-4" />
                    Emitir definitiva
                  </Button>
                )}
                <Button variant="outline" onClick={onClose}>
                  Fechar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {issuingFinal && data && (
        <IssueFinalDialog
          provisional={data}
          onClose={() => setIssuingFinal(false)}
          onIssued={() => {
            queryClient.invalidateQueries({ queryKey: ['endorsement', id] });
            queryClient.invalidateQueries({ queryKey: ['endorsements'] });
          }}
        />
      )}
    </>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2.5 mt-6 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

function Metric({
  label,
  value,
  suffix,
  highlight,
}: {
  label: string;
  value: string;
  suffix?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-md border px-3 py-2.5 ${
        highlight ? 'border-provisional/25 bg-provisional/6' : 'border-border bg-surface-alt/40'
      }`}
    >
      <p className="text-[11.5px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="tabular mt-0.5 text-[16px] font-semibold text-foreground">
        {value}
        {suffix && <span className="ml-1 text-[12px] font-normal text-muted-foreground">{suffix}</span>}
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border py-1.5 last:border-0">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-1.5 text-[13.5px] text-foreground">
        {icon}
        {value}
      </dd>
    </div>
  );
}

function IssueFinalDialog({
  provisional,
  onClose,
  onIssued,
}: {
  provisional: any;
  onClose: () => void;
  onIssued: () => void;
}) {
  const balance = Number(provisional.balance);
  const [values, setValues] = useState({
    insuredAmount: formatMoney(balance),
    berthingDate: provisional.berthingDate?.slice(0, 10) ?? '',
    blNumber: provisional.blNumber ?? '',
    containerNumber: provisional.containerNumber ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const issue = useMutation({
    mutationFn: () =>
      api.post('/endorsements/final', {
        provisionalId: provisional.id,
        insuredAmount: parseNumber(values.insuredAmount),
        berthingDate: values.berthingDate || undefined,
        blNumber: values.blNumber || undefined,
        containerNumber: values.containerNumber || undefined,
      }),
    onSuccess: ({ data }) => {
      toast.success(`Definitiva ${data.number} emitida.`);
      onIssued();
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    const amount = parseNumber(values.insuredAmount);

    if (amount <= 0) found.insuredAmount = 'Informe a importância segurada.';
    else if (amount > balance) found.insuredAmount = `Excede o saldo disponível (${formatMoney(balance)}).`;
    if (!values.berthingDate) found.berthingDate = 'A definitiva exige a data de atracação.';

    setErrors(found);
    if (Object.keys(found).length) return;
    issue.mutate();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader
          title="Emitir definitiva"
          description={`Sobre a provisória ${provisional.number} · saldo ${formatMoney(balance)} ${provisional.currency?.code ?? ''}`}
        />
        <form onSubmit={submit} noValidate className="contents">
          <DialogBody>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Importância segurada"
                htmlFor="insuredAmount"
                required
                error={errors.insuredAmount}
                hint={`Disponível: ${formatMoney(balance)}`}
              >
                <Input
                  id="insuredAmount"
                  autoFocus
                  className="tabular text-right"
                  inputMode="decimal"
                  value={values.insuredAmount}
                  invalid={!!errors.insuredAmount}
                  onChange={(e) => setValues((v) => ({ ...v, insuredAmount: e.target.value }))}
                />
              </Field>

              <Field
                label="Data de atracação"
                htmlFor="berthingDate"
                required
                error={errors.berthingDate}
                hint="A carga precisa estar atracada."
              >
                <Input
                  id="berthingDate"
                  type="date"
                  value={values.berthingDate}
                  invalid={!!errors.berthingDate}
                  onChange={(e) => setValues((v) => ({ ...v, berthingDate: e.target.value }))}
                />
              </Field>

              <Field label="Conhecimento (BL/AWB)" htmlFor="blNumber">
                <Input
                  id="blNumber"
                  value={values.blNumber}
                  onChange={(e) => setValues((v) => ({ ...v, blNumber: e.target.value }))}
                />
              </Field>

              <Field label="Container" htmlFor="containerNumber">
                <Input
                  id="containerNumber"
                  value={values.containerNumber}
                  onChange={(e) => setValues((v) => ({ ...v, containerNumber: e.target.value }))}
                />
              </Field>
            </div>

            <p className="mt-5 text-[13px] leading-relaxed text-muted-foreground">
              O prêmio da definitiva é proporcional à fatia consumida da provisória, e as comissões
              são geradas automaticamente sobre esse prêmio.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={issue.isPending}>
              Emitir definitiva
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
