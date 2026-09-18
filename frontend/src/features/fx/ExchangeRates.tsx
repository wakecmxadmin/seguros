import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CloudDownload, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Field } from '@/components/ui/field';
import { DataTable, type Column } from '@/components/ui/table';
import { EmptyState, Loading, LoadError } from '@/components/ui/states';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from '@/components/ui/dialog';
import { api, errorMessage } from '@/lib/api';
import { formatDate, parseNumber } from '@/lib/format';
import { useAuth } from '@/stores/auth';

interface Rate {
  id: string;
  date: string;
  /** PTAX pura do dia, quando importada. */
  baseRate: string | null;
  /** Taxa efetivamente usada no cálculo — oficial (+6%) ou lançamento manual. */
  appliedRate: string | null;
  appliedSource: 'OFICIAL' | 'MANUAL' | null;
  currency: { id: string; code: string; name: string };
}

/** Últimos 30 dias como janela padrão. */
function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export default function ExchangeRates() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [range, setRange] = useState(defaultRange);
  const [currencyId, setCurrencyId] = useState('');
  const [importing, setImporting] = useState(false);
  const [manual, setManual] = useState(false);

  const { data: currencies } = useQuery({
    queryKey: ['catalog-options', 'currencies'],
    queryFn: async () => {
      const { data } = await api.get('/catalog/currencies/options');
      return data as Array<{ id: string; label: string; code: string }>;
    },
  });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['exchange-rates', range, currencyId],
    queryFn: async () => {
      const { data } = await api.get('/exchange-rates', {
        params: { from: range.from, to: range.to, ...(currencyId ? { currencyId } : {}), perPage: 400 },
      });
      return data as { items: Rate[]; total: number };
    },
  });

  const items = data?.items ?? [];
  const canEdit = can('exchange_rate:update');

  const columns: Column<Rate>[] = [
    {
      key: 'date',
      header: 'Data',
      width: '130px',
      render: (row) => <span className="tabular">{formatDate(row.date)}</span>,
    },
    {
      key: 'currency',
      header: 'Moeda',
      width: '180px',
      render: (row) => (
        <span>
          <span className="tabular font-medium text-foreground">{row.currency.code}</span>
          <span className="ml-2 text-muted-foreground">{row.currency.name}</span>
        </span>
      ),
    },
    {
      key: 'baseRate',
      header: 'Valor base — PTAX (R$)',
      numeric: true,
      render: (row) => (row.baseRate ? Number(row.baseRate).toFixed(4).replace('.', ',') : '—'),
    },
    {
      key: 'appliedRate',
      header: 'Valor +6% (R$)',
      numeric: true,
      render: (row) =>
        row.appliedRate ? Number(row.appliedRate).toFixed(4).replace('.', ',') : '—',
    },
    {
      key: 'source',
      header: 'Origem',
      width: '160px',
      render: (row) => {
        if (row.appliedSource === 'MANUAL') return <Badge variant="warning">Manual</Badge>;
        if (row.appliedSource === 'OFICIAL') return <Badge variant="success">Oficial · +6%</Badge>;
        return <Badge variant="info">PTAX · sem fórmula</Badge>;
      },
    },
  ];

  return (
    <div>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-[18px] font-semibold tracking-tight text-foreground">
            Cotações diárias
          </h2>
          <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
            Câmbio usado para converter prêmio e importância segurada em reais. A PTAX do Banco
            Central é importada automaticamente todo dia útil — no legado, alguém digitava a
            cotação do dólar manualmente. Para Dólar, Euro, Franco Suíço, Iene e Libra Esterlina, a
            coluna "Valor +6%" mostra a <strong className="font-medium text-foreground">taxa
            oficial da corretora</strong> (PTAX + 6%, fórmula confirmada) — é ela que entra no
            cálculo do prêmio; a coluna "Valor base" é a PTAX pura, só para referência. Use
            "Importar PTAX" para reimportar um período específico ou "Lançar manual" para corrigir
            uma data.
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setManual(true)}>
              <Plus className="h-4 w-4" />
              Lançar manual
            </Button>
            <Button size="sm" onClick={() => setImporting(true)}>
              <CloudDownload className="h-4 w-4" />
              Importar PTAX
            </Button>
          </div>
        )}
      </header>

      <div className="mb-3 flex flex-wrap items-end gap-2.5">
        <Field label="De" htmlFor="from" className="w-auto">
          <Input
            id="from"
            type="date"
            className="h-9"
            value={range.from}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
          />
        </Field>
        <Field label="Até" htmlFor="to" className="w-auto">
          <Input
            id="to"
            type="date"
            className="h-9"
            value={range.to}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
          />
        </Field>
        <Field label="Moeda" htmlFor="currency" className="w-auto min-w-[180px]">
          <Select
            id="currency"
            className="h-9"
            value={currencyId}
            onChange={(e) => setCurrencyId(e.target.value)}
          >
            <option value="">Todas</option>
            {currencies?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
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
            title="Nenhuma cotação no período"
            description="Importe a PTAX do Banco Central ou lance a cotação manualmente."
            action={
              canEdit ? (
                <Button size="sm" onClick={() => setImporting(true)}>
                  <CloudDownload className="h-4 w-4" />
                  Importar PTAX
                </Button>
              ) : undefined
            }
          />
        ) : (
          <DataTable columns={columns} rows={items} rowKey={(r) => r.id} />
        )}
      </div>

      {data && items.length > 0 && (
        <p className="mt-2.5 text-[13px] text-muted-foreground">
          {data.total} cotação{data.total === 1 ? '' : 'ões'} no período
        </p>
      )}

      {importing && (
        <ImportPtaxDialog
          onClose={() => setImporting(false)}
          onDone={() => queryClient.invalidateQueries({ queryKey: ['exchange-rates'] })}
        />
      )}

      {manual && (
        <ManualRateDialog
          currencies={currencies ?? []}
          onClose={() => setManual(false)}
          onDone={() => queryClient.invalidateQueries({ queryKey: ['exchange-rates'] })}
        />
      )}
    </div>
  );
}

function ImportPtaxDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [range, setRange] = useState(defaultRange);

  const run = useMutation({
    mutationFn: () => api.post('/exchange-rates/import-ptax', range),
    onSuccess: ({ data }) => {
      const skipped = data.results.filter((r: any) => r.skipped);
      toast.success(`${data.total} cotações importadas do Banco Central.`);
      if (skipped.length) {
        toast.warning(
          `Sem dados para: ${skipped.map((r: any) => r.code).join(', ')}.`,
        );
      }
      onDone();
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader
          title="Importar PTAX"
          description="Busca as cotações do Banco Central para o período e calcula a taxa oficial (PTAX + 6%) das moedas com fórmula confirmada."
        />
        <DialogBody>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Data inicial" htmlFor="ptaxFrom">
              <Input
                id="ptaxFrom"
                type="date"
                value={range.from}
                onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
              />
            </Field>
            <Field label="Data final" htmlFor="ptaxTo">
              <Input
                id="ptaxTo"
                type="date"
                value={range.to}
                onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
              />
            </Field>
          </div>
          <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
            Reimportar o mesmo período apenas atualiza os valores — nada é duplicado.
            Lançamentos manuais no período serão sobrescritos.
          </p>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button loading={run.isPending} onClick={() => run.mutate()}>
            {run.isPending ? 'Importando…' : 'Importar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManualRateDialog({
  currencies,
  onClose,
  onDone,
}: {
  currencies: Array<{ id: string; label: string }>;
  onClose: () => void;
  onDone: () => void;
}) {
  const [values, setValues] = useState({
    date: new Date().toISOString().slice(0, 10),
    currencyId: '',
    rate: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: () =>
      api.post('/exchange-rates', {
        date: values.date,
        currencyId: values.currencyId,
        rate: parseNumber(values.rate),
      }),
    onSuccess: () => {
      toast.success('Cotação lançada.');
      onDone();
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (!values.currencyId) found.currencyId = 'Selecione a moeda.';
    if (parseNumber(values.rate) <= 0) found.rate = 'Informe uma cotação maior que zero.';
    setErrors(found);
    if (Object.keys(found).length) return;
    save.mutate();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader
          title="Lançar cotação manual"
          description="Use quando a taxa do dia precisar ser diferente da PTAX."
        />
        <form onSubmit={submit} noValidate className="contents">
          <DialogBody>
            <div className="grid gap-4">
              <Field label="Data" htmlFor="date" required>
                <Input
                  id="date"
                  type="date"
                  value={values.date}
                  onChange={(e) => setValues((v) => ({ ...v, date: e.target.value }))}
                />
              </Field>
              <Field label="Moeda" htmlFor="currencyId" required error={errors.currencyId}>
                <Select
                  id="currencyId"
                  value={values.currencyId}
                  invalid={!!errors.currencyId}
                  onChange={(e) => setValues((v) => ({ ...v, currencyId: e.target.value }))}
                >
                  <option value="">Selecione…</option>
                  {currencies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Cotação em reais"
                htmlFor="rate"
                required
                error={errors.rate}
                hint="Quantos reais valem uma unidade da moeda."
              >
                <Input
                  id="rate"
                  className="tabular text-right"
                  inputMode="decimal"
                  placeholder="5,4944"
                  value={values.rate}
                  invalid={!!errors.rate}
                  onChange={(e) => setValues((v) => ({ ...v, rate: e.target.value }))}
                />
              </Field>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={save.isPending}>
              Lançar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
