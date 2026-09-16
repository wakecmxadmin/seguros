import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Field } from '@/components/ui/field';
import { Combobox } from '@/components/ui/combobox';
import { DataTable, type Column } from '@/components/ui/table';
import { EmptyState, Loading, LoadError } from '@/components/ui/states';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from '@/components/ui/dialog';
import { api, errorMessage } from '@/lib/api';
import { formatDate, formatRate, parseNumber } from '@/lib/format';
import { Modal, QuoteKind } from '@/lib/enums';
import { useAuth } from '@/stores/auth';

interface ClientRate {
  id: string;
  clientId: string;
  scope: string;
  rateClient: string;
  rateInsurer: string;
  minimumPremium: string | null;
  validFrom: string | null;
  validTo: string | null;
  active: boolean;
  client: { id: string; legalName: string; tradeName: string | null };
  policy: { id: string; number: string } | null;
  coverage: { id: string; name: string } | null;
  commodityType: { id: string; name: string } | null;
}

export default function ClientRates() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientLabel, setClientLabel] = useState<string | null>(null);
  const [editing, setEditing] = useState<ClientRate | null>(null);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<ClientRate | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['client-rates', clientId],
    queryFn: async () => {
      const { data } = await api.get('/client-rates', {
        params: clientId ? { clientId } : undefined,
      });
      return data as ClientRate[];
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/client-rates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-rates'] });
      setRemoving(null);
      toast.success('Taxa removida.');
    },
    onError: (error) => {
      setRemoving(null);
      toast.error(errorMessage(error));
    },
  });

  const items = data ?? [];
  const canEdit = can('rate:update');

  const columns: Column<ClientRate>[] = [
    {
      key: 'client',
      header: 'Cliente',
      render: (row) => (
        <span className="text-foreground">
          {row.client.tradeName || row.client.legalName}
        </span>
      ),
    },
    {
      key: 'scope',
      header: 'Vale para',
      render: (row) => (
        <span className={row.scope.startsWith('Todos') ? 'text-muted-foreground' : 'text-foreground'}>
          {row.scope}
        </span>
      ),
    },
    {
      key: 'rates',
      header: 'Cliente / Seguradora',
      numeric: true,
      render: (row) => (
        <span>
          {formatRate(row.rateClient)} <span className="text-muted-foreground">/</span>{' '}
          {formatRate(row.rateInsurer)}
        </span>
      ),
    },
    {
      key: 'validity',
      header: 'Vigência',
      render: (row) => {
        if (!row.validFrom && !row.validTo) {
          return <span className="text-muted-foreground">sem prazo</span>;
        }
        return (
          <span className="tabular text-[13px] text-muted-foreground">
            {row.validFrom ? formatDate(row.validFrom) : '…'} → {row.validTo ? formatDate(row.validTo) : '…'}
          </span>
        );
      },
    },
    {
      key: 'active',
      header: 'Situação',
      width: '100px',
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
      width: '90px',
      render: (row) => (
        <div className="flex items-center justify-end gap-0.5">
          <Button variant="ghost" size="icon" title="Editar" onClick={() => setEditing(row)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" title="Remover" onClick={() => setRemoving(row)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    });
  }

  return (
    <div>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-[18px] font-semibold tracking-tight text-foreground">
            Taxas por cliente
          </h2>
          <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
            Cada cliente pode ter uma taxa negociada. A regra mais específica vence — uma taxa só
            para o modal aéreo se sobrepõe à taxa geral do cliente, que por sua vez se sobrepõe à
            da apólice.
          </p>
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            Nova taxa
          </Button>
        )}
      </header>

      <div className="mb-3 max-w-sm">
        <Field label="Filtrar por cliente">
          <Combobox
            endpoint="/companies/options"
            params={{ role: 'CLIENT' }}
            value={clientId}
            selectedLabel={clientLabel}
            placeholder="Todos os clientes"
            onChange={(id, option) => {
              setClientId(id);
              setClientLabel(option?.label ?? null);
            }}
          />
        </Field>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
        {isLoading ? (
          <Loading />
        ) : isError ? (
          <LoadError message={errorMessage(error)} />
        ) : items.length === 0 ? (
          <EmptyState
            title="Nenhuma taxa cadastrada"
            description="Sem regra específica, o cálculo usa a taxa da cobertura ou da apólice."
            action={
              canEdit ? (
                <Button size="sm" onClick={() => setCreating(true)}>
                  <Plus className="h-4 w-4" />
                  Nova taxa
                </Button>
              ) : undefined
            }
          />
        ) : (
          <DataTable columns={columns} rows={items} rowKey={(r) => r.id} />
        )}
      </div>

      {(creating || editing) && (
        <ClientRateDialog
          rate={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ['client-rates'] })}
        />
      )}

      {removing && (
        <ConfirmDialog
          title="Remover taxa?"
          description={`A regra "${removing.scope}" de ${removing.client.tradeName || removing.client.legalName} será removida. As cotações passarão a usar a taxa da cobertura ou da apólice.`}
          confirmLabel="Remover"
          destructive
          loading={remove.isPending}
          onConfirm={() => remove.mutate(removing.id)}
          onCancel={() => setRemoving(null)}
        />
      )}
    </div>
  );
}

function ClientRateDialog({
  rate,
  onClose,
  onSaved,
}: {
  rate: ClientRate | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = !!rate;

  const [values, setValues] = useState({
    clientId: rate?.clientId ?? null,
    clientLabel: rate ? rate.client.tradeName || rate.client.legalName : null,
    kind: (rate as any)?.kind ?? '',
    policyId: rate?.policy?.id ?? '',
    coverageId: rate?.coverage?.id ?? '',
    commodityTypeId: rate?.commodityType?.id ?? '',
    modal: (rate as any)?.modal ?? '',
    rateClient: rate ? formatRate(rate.rateClient) : '0,00000',
    rateInsurer: rate ? formatRate(rate.rateInsurer) : '0,00000',
    minimumPremium: rate?.minimumPremium ? formatRate(rate.minimumPremium) : '',
    validFrom: rate?.validFrom?.slice(0, 10) ?? '',
    validTo: rate?.validTo?.slice(0, 10) ?? '',
    active: rate?.active ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (key: string, value: any) => setValues((v) => ({ ...v, [key]: value }));

  const { data: policies } = useQuery({
    queryKey: ['policy-options-all'],
    queryFn: async () => {
      const { data } = await api.get('/policies/options');
      return data as Array<{ id: string; label: string }>;
    },
  });

  const { data: coverages } = useQuery({
    queryKey: ['coverages'],
    queryFn: async () => {
      const { data } = await api.get('/coverages');
      return data as Array<{ id: string; name: string; accessory: boolean }>;
    },
  });

  const { data: commodityTypes } = useQuery({
    queryKey: ['catalog-options', 'commodity-types'],
    queryFn: async () => {
      const { data } = await api.get('/catalog/commodity-types/options');
      return data as Array<{ id: string; label: string }>;
    },
  });

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        clientId: values.clientId,
        kind: values.kind || undefined,
        policyId: values.policyId || undefined,
        coverageId: values.coverageId || undefined,
        commodityTypeId: values.commodityTypeId || undefined,
        modal: values.modal || undefined,
        rateClient: parseNumber(values.rateClient),
        rateInsurer: parseNumber(values.rateInsurer),
        minimumPremium: values.minimumPremium ? parseNumber(values.minimumPremium) : undefined,
        validFrom: values.validFrom || undefined,
        validTo: values.validTo || undefined,
        active: values.active,
      };
      return isEditing
        ? api.patch(`/client-rates/${rate!.id}`, payload)
        : api.post('/client-rates', payload);
    },
    onSuccess: () => {
      toast.success(isEditing ? 'Taxa atualizada.' : 'Taxa cadastrada.');
      onSaved();
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (!values.clientId) found.clientId = 'Selecione o cliente.';
    if (parseNumber(values.rateClient) <= 0) found.rateClient = 'Informe a taxa do cliente.';
    setErrors(found);
    if (Object.keys(found).length) return;
    save.mutate();
  }

  const scopeCount = [
    values.kind,
    values.policyId,
    values.coverageId,
    values.commodityTypeId,
    values.modal,
  ].filter(Boolean).length;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader
          title={isEditing ? 'Editar taxa' : 'Nova taxa de cliente'}
          description="Deixe os escopos em branco para valer em qualquer processo do cliente."
        />

        <form onSubmit={submit} noValidate className="contents">
          <DialogBody>
            <Field label="Cliente" required error={errors.clientId}>
              <Combobox
                endpoint="/companies/options"
                params={{ role: 'CLIENT' }}
                value={values.clientId}
                selectedLabel={values.clientLabel}
                invalid={!!errors.clientId}
                disabled={isEditing}
                placeholder="Buscar por nome ou CNPJ"
                onChange={(id, option) => {
                  set('clientId', id);
                  set('clientLabel', option?.label ?? null);
                }}
              />
            </Field>

            <p className="mb-3 mt-6 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
              Escopo
              <span className="ml-2 font-normal normal-case tracking-normal text-muted-foreground">
                {scopeCount === 0
                  ? '— vale para todos os processos deste cliente'
                  : `— ${scopeCount} restrição(ões)`}
              </span>
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Ramo" htmlFor="kind">
                <Select id="kind" value={values.kind} onChange={(e) => set('kind', e.target.value)}>
                  <option value="">Qualquer</option>
                  {Object.entries(QuoteKind).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Modal" htmlFor="modal">
                <Select id="modal" value={values.modal} onChange={(e) => set('modal', e.target.value)}>
                  <option value="">Qualquer</option>
                  {Object.entries(Modal).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Apólice" htmlFor="policyId">
                <Select
                  id="policyId"
                  value={values.policyId}
                  onChange={(e) => set('policyId', e.target.value)}
                >
                  <option value="">Qualquer</option>
                  {policies?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Cobertura" htmlFor="coverageId">
                <Select
                  id="coverageId"
                  value={values.coverageId}
                  onChange={(e) => set('coverageId', e.target.value)}
                >
                  <option value="">Qualquer</option>
                  {coverages
                    ?.filter((c) => !c.accessory)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </Select>
              </Field>

              <Field label="Tipo de mercadoria" htmlFor="commodityTypeId" className="sm:col-span-2">
                <Select
                  id="commodityTypeId"
                  value={values.commodityTypeId}
                  onChange={(e) => set('commodityTypeId', e.target.value)}
                >
                  <option value="">Qualquer</option>
                  {commodityTypes?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <p className="mb-3 mt-6 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
              Taxas
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Cliente (%)" htmlFor="rateClient" required error={errors.rateClient}>
                <Input
                  id="rateClient"
                  className="tabular text-right"
                  inputMode="decimal"
                  value={values.rateClient}
                  invalid={!!errors.rateClient}
                  onChange={(e) => set('rateClient', e.target.value)}
                />
              </Field>
              <Field label="Seguradora (%)" htmlFor="rateInsurer">
                <Input
                  id="rateInsurer"
                  className="tabular text-right"
                  inputMode="decimal"
                  value={values.rateInsurer}
                  onChange={(e) => set('rateInsurer', e.target.value)}
                />
              </Field>
              <Field
                label="Prêmio mínimo"
                htmlFor="minimumPremium"
                hint="Em branco usa o da apólice."
              >
                <Input
                  id="minimumPremium"
                  className="tabular text-right"
                  inputMode="decimal"
                  value={values.minimumPremium}
                  onChange={(e) => set('minimumPremium', e.target.value)}
                />
              </Field>
            </div>

            <p className="mb-3 mt-6 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
              Vigência
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="A partir de" htmlFor="validFrom">
                <Input
                  id="validFrom"
                  type="date"
                  value={values.validFrom}
                  onChange={(e) => set('validFrom', e.target.value)}
                />
              </Field>
              <Field label="Até" htmlFor="validTo">
                <Input
                  id="validTo"
                  type="date"
                  value={values.validTo}
                  onChange={(e) => set('validTo', e.target.value)}
                />
              </Field>
            </div>

            <div className="mt-5 flex items-center gap-2.5">
              <Switch id="active" checked={values.active} onCheckedChange={(v) => set('active', v)} />
              <label htmlFor="active" className="cursor-pointer text-[14px] text-foreground">
                Taxa ativa
              </label>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={save.isPending}>
              {isEditing ? 'Salvar' : 'Cadastrar taxa'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
