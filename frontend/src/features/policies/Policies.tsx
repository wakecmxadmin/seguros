import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Pencil, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
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
import { formatMoney, formatRate, parseNumber } from '@/lib/format';
import { QuoteKind } from '@/lib/enums';
import { useAuth } from '@/stores/auth';

interface Policy {
  id: string;
  number: string;
  description: string | null;
  kind: 'IMPORT' | 'EXPORT';
  insurerId: string;
  insurer: { id: string; legalName: string; tradeName: string | null };
  insuredLimit: string;
  baseRateClient: string;
  baseRateInsurer: string;
  minimumPremium: string;
  validFrom: string | null;
  validTo: string | null;
  active: boolean;
  _count?: { quotes: number };
}

export default function Policies() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('');
  const [editing, setEditing] = useState<Policy | null>(null);
  const [creating, setCreating] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['policies', search, kind],
    queryFn: async () => {
      const { data } = await api.get('/policies', {
        params: { ...(search ? { search } : {}), ...(kind ? { kind } : {}), perPage: 100 },
      });
      return data as { items: Policy[]; total: number };
    },
  });

  const items = data?.items ?? [];
  const canEdit = can('policy:update');

  const columns: Column<Policy>[] = [
    {
      key: 'number',
      header: 'Apólice',
      render: (row) => (
        <div className="min-w-0">
          <span className="tabular block truncate font-medium text-foreground">{row.number}</span>
          {row.description && (
            <span className="block truncate text-[12.5px] text-muted-foreground">
              {row.description}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'insurer',
      header: 'Seguradora',
      render: (row) => row.insurer.tradeName || row.insurer.legalName,
    },
    {
      key: 'kind',
      header: 'Ramo',
      width: '120px',
      render: (row) => <Badge variant="neutral">{QuoteKind[row.kind]}</Badge>,
    },
    {
      key: 'rates',
      header: 'Taxa cliente / seguradora',
      numeric: true,
      render: (row) => (
        <span>
          {formatRate(row.baseRateClient)} <span className="text-muted-foreground">/</span>{' '}
          {formatRate(row.baseRateInsurer)}
        </span>
      ),
    },
    {
      key: 'minimumPremium',
      header: 'Prêmio mínimo',
      numeric: true,
      render: (row) => formatMoney(row.minimumPremium),
    },
    {
      key: 'active',
      header: 'Situação',
      width: '110px',
      render: (row) =>
        row.active ? (
          <Badge variant="success" dot>
            Ativa
          </Badge>
        ) : (
          <Badge variant="neutral">Inativa</Badge>
        ),
    },
  ];

  if (canEdit) {
    columns.push({
      key: 'actions',
      header: '',
      width: '60px',
      render: (row) => (
        <div className="flex justify-end">
          <Button variant="ghost" size="icon" title="Editar" onClick={() => setEditing(row)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    });
  }

  return (
    <div>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-[18px] font-semibold tracking-tight text-foreground">Apólices</h2>
          <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
            Contratos com as seguradoras. Taxa e prêmio mínimo agora são campos próprios — no legado
            ficavam escondidos no texto do nome da apólice.
          </p>
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            Nova apólice
          </Button>
        )}
      </header>

      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[240px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por número ou descrição"
            className="h-9 pl-9"
          />
        </div>
        <div className="flex items-center gap-1 rounded-md border border-border bg-surface p-0.5">
          {[
            { value: '', label: 'Todas' },
            { value: 'IMPORT', label: 'Importação' },
            { value: 'EXPORT', label: 'Exportação' },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setKind(option.value)}
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
            title="Nenhuma apólice cadastrada"
            description={
              search || kind
                ? 'Ajuste a busca ou o filtro.'
                : 'Cadastre a apólice para poder emitir cotações.'
            }
            action={
              canEdit && !search && !kind ? (
                <Button size="sm" onClick={() => setCreating(true)}>
                  <Plus className="h-4 w-4" />
                  Nova apólice
                </Button>
              ) : undefined
            }
          />
        ) : (
          <DataTable columns={columns} rows={items} rowKey={(r) => r.id} />
        )}
      </div>

      {(creating || editing) && (
        <PolicyDialog
          policy={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ['policies'] })}
        />
      )}
    </div>
  );
}

function PolicyDialog({
  policy,
  onClose,
  onSaved,
}: {
  policy: Policy | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = !!policy;

  const { data: insurers } = useQuery({
    queryKey: ['company-options', 'INSURER'],
    queryFn: async () => {
      const { data } = await api.get('/companies/options', { params: { role: 'INSURER' } });
      return data as Array<{ id: string; label: string }>;
    },
  });

  const { data: currencies } = useQuery({
    queryKey: ['catalog-options', 'currencies'],
    queryFn: async () => {
      const { data } = await api.get('/catalog/currencies/options');
      return data as Array<{ id: string; label: string }>;
    },
  });

  const [values, setValues] = useState({
    number: policy?.number ?? '',
    description: policy?.description ?? '',
    kind: policy?.kind ?? 'IMPORT',
    insurerId: policy?.insurerId ?? '',
    insuredLimit: policy ? formatMoney(policy.insuredLimit) : '0,00',
    baseRateClient: policy ? formatRate(policy.baseRateClient) : '0,00000',
    baseRateInsurer: policy ? formatRate(policy.baseRateInsurer) : '0,00000',
    minimumPremium: policy ? formatMoney(policy.minimumPremium) : '0,00',
    minimumPremiumCurrencyId: (policy as any)?.minimumPremiumCurrencyId ?? '',
    validFrom: policy?.validFrom?.slice(0, 10) ?? '',
    validTo: policy?.validTo?.slice(0, 10) ?? '',
    active: policy?.active ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (key: string, value: any) => setValues((v) => ({ ...v, [key]: value }));

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        number: values.number,
        description: values.description || undefined,
        kind: values.kind,
        insurerId: values.insurerId,
        insuredLimit: parseNumber(values.insuredLimit),
        baseRateClient: parseNumber(values.baseRateClient),
        baseRateInsurer: parseNumber(values.baseRateInsurer),
        minimumPremium: parseNumber(values.minimumPremium),
        minimumPremiumCurrencyId: values.minimumPremiumCurrencyId || undefined,
        validFrom: values.validFrom || undefined,
        validTo: values.validTo || undefined,
        active: values.active,
      };
      return isEditing
        ? api.patch(`/policies/${policy!.id}`, payload)
        : api.post('/policies', payload);
    },
    onSuccess: () => {
      toast.success(isEditing ? 'Apólice atualizada.' : 'Apólice cadastrada.');
      onSaved();
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (!values.number.trim()) found.number = 'Informe o número da apólice.';
    if (!values.insurerId) found.insurerId = 'Selecione a seguradora.';
    setErrors(found);
    if (Object.keys(found).length) return;
    save.mutate();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader
          title={isEditing ? 'Editar apólice' : 'Nova apólice'}
          description="A taxa base e o prêmio mínimo definidos aqui alimentam o cálculo da cotação."
        />

        <form onSubmit={submit} noValidate className="contents">
          <DialogBody>
            <div className="grid gap-4 sm:grid-cols-6">
              <Field
                label="Número da apólice"
                htmlFor="number"
                required
                error={errors.number}
                className="sm:col-span-3"
              >
                <Input
                  id="number"
                  autoFocus
                  className="tabular"
                  value={values.number}
                  invalid={!!errors.number}
                  onChange={(e) => set('number', e.target.value)}
                />
              </Field>

              <Field label="Ramo" htmlFor="kind" required className="sm:col-span-3">
                <Select id="kind" value={values.kind} onChange={(e) => set('kind', e.target.value)}>
                  <option value="IMPORT">Importação</option>
                  <option value="EXPORT">Exportação</option>
                </Select>
              </Field>

              <Field
                label="Seguradora"
                htmlFor="insurerId"
                required
                error={errors.insurerId}
                hint={
                  insurers?.length === 0
                    ? 'Nenhuma empresa tem o papel de seguradora. Cadastre uma em Empresas.'
                    : undefined
                }
                className="sm:col-span-4"
              >
                <Select
                  id="insurerId"
                  value={values.insurerId}
                  invalid={!!errors.insurerId}
                  onChange={(e) => set('insurerId', e.target.value)}
                >
                  <option value="">Selecione…</option>
                  {insurers?.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Descrição" htmlFor="description" className="sm:col-span-6">
                <Input
                  id="description"
                  placeholder="Ex.: Cobertura ampla para importação marítima"
                  value={values.description}
                  onChange={(e) => set('description', e.target.value)}
                />
              </Field>
            </div>

            <p className="mb-3 mt-6 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
              Tarifação
            </p>
            <div className="grid gap-4 sm:grid-cols-6">
              <Field
                label="Taxa base — cliente (%)"
                htmlFor="baseRateClient"
                hint="O que é cobrado do segurado."
                className="sm:col-span-3"
              >
                <Input
                  id="baseRateClient"
                  className="tabular text-right"
                  inputMode="decimal"
                  value={values.baseRateClient}
                  onChange={(e) => set('baseRateClient', e.target.value)}
                />
              </Field>

              <Field
                label="Taxa base — seguradora (%)"
                htmlFor="baseRateInsurer"
                hint="O custo de repasse. A diferença é a margem."
                className="sm:col-span-3"
              >
                <Input
                  id="baseRateInsurer"
                  className="tabular text-right"
                  inputMode="decimal"
                  value={values.baseRateInsurer}
                  onChange={(e) => set('baseRateInsurer', e.target.value)}
                />
              </Field>

              <Field
                label="Prêmio mínimo"
                htmlFor="minimumPremium"
                hint="Piso aplicado ao prêmio do cliente."
                className="sm:col-span-2"
              >
                <Input
                  id="minimumPremium"
                  className="tabular text-right"
                  inputMode="decimal"
                  value={values.minimumPremium}
                  onChange={(e) => set('minimumPremium', e.target.value)}
                />
              </Field>

              <Field label="Moeda do prêmio mínimo" htmlFor="minimumPremiumCurrencyId" className="sm:col-span-2">
                <Select
                  id="minimumPremiumCurrencyId"
                  value={values.minimumPremiumCurrencyId}
                  onChange={(e) => set('minimumPremiumCurrencyId', e.target.value)}
                >
                  <option value="">Selecione…</option>
                  {currencies?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Limite de I.S." htmlFor="insuredLimit" className="sm:col-span-2">
                <Input
                  id="insuredLimit"
                  className="tabular text-right"
                  inputMode="decimal"
                  value={values.insuredLimit}
                  onChange={(e) => set('insuredLimit', e.target.value)}
                />
              </Field>
            </div>

            <p className="mb-3 mt-6 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
              Vigência
            </p>
            <div className="grid gap-4 sm:grid-cols-6">
              <Field label="Início" htmlFor="validFrom" className="sm:col-span-2">
                <Input
                  id="validFrom"
                  type="date"
                  value={values.validFrom}
                  onChange={(e) => set('validFrom', e.target.value)}
                />
              </Field>
              <Field label="Fim" htmlFor="validTo" className="sm:col-span-2">
                <Input
                  id="validTo"
                  type="date"
                  value={values.validTo}
                  onChange={(e) => set('validTo', e.target.value)}
                />
              </Field>
            </div>

            <div className="mt-6 flex items-center gap-2.5">
              <Switch id="active" checked={values.active} onCheckedChange={(v) => set('active', v)} />
              <label htmlFor="active" className="cursor-pointer text-[14px] text-foreground">
                Apólice ativa
              </label>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={save.isPending}>
              {isEditing ? 'Salvar alterações' : 'Cadastrar apólice'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
