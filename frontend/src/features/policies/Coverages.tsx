import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Pencil, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Field } from '@/components/ui/field';
import { DataTable, type Column } from '@/components/ui/table';
import { Loading, LoadError } from '@/components/ui/states';
import {
  Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader,
} from '@/components/ui/dialog';
import { api, errorMessage } from '@/lib/api';
import { formatRate, parseNumber } from '@/lib/format';
import { useAuth } from '@/stores/auth';

interface Coverage {
  id: string;
  name: string;
  description: string | null;
  accessory: boolean;
  seaRateInsurer: string;
  seaRateClient: string;
  airRateInsurer: string;
  airRateClient: string;
  active: boolean;
}

export default function Coverages() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Coverage | null>(null);
  const [creating, setCreating] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['coverages'],
    queryFn: async () => {
      const { data } = await api.get('/coverages');
      return data as Coverage[];
    },
  });

  const canEdit = can('coverage:update');
  const items = data ?? [];

  const columns: Column<Coverage>[] = [
    {
      key: 'name',
      header: 'Cobertura',
      render: (row) => (
        <div className="min-w-0">
          <span className="block font-medium text-foreground">{row.name}</span>
          {row.description && (
            <span className="block text-[12.5px] leading-snug text-muted-foreground">
              {row.description}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'accessory',
      header: 'Tipo',
      width: '120px',
      render: (row) =>
        row.accessory ? (
          <Badge variant="neutral">Acessória</Badge>
        ) : (
          <Badge variant="info">Principal</Badge>
        ),
    },
    {
      key: 'sea',
      header: 'Marítimo cli./seg.',
      numeric: true,
      render: (row) => `${formatRate(row.seaRateClient)} / ${formatRate(row.seaRateInsurer)}`,
    },
    {
      key: 'air',
      header: 'Aéreo cli./seg.',
      numeric: true,
      render: (row) => `${formatRate(row.airRateClient)} / ${formatRate(row.airRateInsurer)}`,
    },
    {
      key: 'active',
      header: 'Situação',
      width: '100px',
      render: (row) =>
        row.active ? <Badge variant="success" dot>Ativa</Badge> : <Badge variant="neutral">Inativa</Badge>,
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
          <h2 className="text-[18px] font-semibold tracking-tight text-foreground">Coberturas</h2>
          <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
            Cláusulas ICC (A, B, C) e coberturas acessórias. As taxas por modal preenchem
            automaticamente a grade da cotação — no legado estavam todas zeradas e a taxa era
            digitada à mão em cada processo.
          </p>
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            Nova cobertura
          </Button>
        )}
      </header>

      <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
        {isLoading ? (
          <Loading />
        ) : isError ? (
          <LoadError message={errorMessage(error)} />
        ) : (
          <DataTable columns={columns} rows={items} rowKey={(r) => r.id} />
        )}
      </div>

      {(creating || editing) && (
        <CoverageDialog
          coverage={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ['coverages'] })}
        />
      )}
    </div>
  );
}

function CoverageDialog({
  coverage,
  onClose,
  onSaved,
}: {
  coverage: Coverage | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = !!coverage;
  const [values, setValues] = useState({
    name: coverage?.name ?? '',
    description: coverage?.description ?? '',
    accessory: coverage?.accessory ?? false,
    seaRateClient: coverage ? formatRate(coverage.seaRateClient) : '0,00000',
    seaRateInsurer: coverage ? formatRate(coverage.seaRateInsurer) : '0,00000',
    airRateClient: coverage ? formatRate(coverage.airRateClient) : '0,00000',
    airRateInsurer: coverage ? formatRate(coverage.airRateInsurer) : '0,00000',
    active: coverage?.active ?? true,
  });
  const [error, setError] = useState('');

  const set = (key: string, value: any) => setValues((v) => ({ ...v, [key]: value }));

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: values.name,
        description: values.description || undefined,
        accessory: values.accessory,
        seaRateClient: parseNumber(values.seaRateClient),
        seaRateInsurer: parseNumber(values.seaRateInsurer),
        airRateClient: parseNumber(values.airRateClient),
        airRateInsurer: parseNumber(values.airRateInsurer),
        active: values.active,
      };
      return isEditing
        ? api.patch(`/coverages/${coverage!.id}`, payload)
        : api.post('/coverages', payload);
    },
    onSuccess: () => {
      toast.success(isEditing ? 'Cobertura atualizada.' : 'Cobertura cadastrada.');
      onSaved();
      onClose();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (values.name.trim().length < 2) {
      setError('Informe o nome da cobertura.');
      return;
    }
    setError('');
    save.mutate();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader title={isEditing ? 'Editar cobertura' : 'Nova cobertura'} />
        <form onSubmit={submit} noValidate className="contents">
          <DialogBody>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome" htmlFor="name" required error={error} className="sm:col-span-2">
                <Input
                  id="name"
                  autoFocus
                  value={values.name}
                  invalid={!!error}
                  onChange={(e) => set('name', e.target.value)}
                />
              </Field>
              <Field label="Descrição" htmlFor="description" className="sm:col-span-2">
                <Input
                  id="description"
                  value={values.description}
                  onChange={(e) => set('description', e.target.value)}
                />
              </Field>

              <Field label="Taxa marítima — cliente (%)" htmlFor="seaRateClient">
                <Input
                  id="seaRateClient"
                  className="tabular text-right"
                  inputMode="decimal"
                  value={values.seaRateClient}
                  onChange={(e) => set('seaRateClient', e.target.value)}
                />
              </Field>
              <Field label="Taxa marítima — seguradora (%)" htmlFor="seaRateInsurer">
                <Input
                  id="seaRateInsurer"
                  className="tabular text-right"
                  inputMode="decimal"
                  value={values.seaRateInsurer}
                  onChange={(e) => set('seaRateInsurer', e.target.value)}
                />
              </Field>
              <Field label="Taxa aérea — cliente (%)" htmlFor="airRateClient">
                <Input
                  id="airRateClient"
                  className="tabular text-right"
                  inputMode="decimal"
                  value={values.airRateClient}
                  onChange={(e) => set('airRateClient', e.target.value)}
                />
              </Field>
              <Field label="Taxa aérea — seguradora (%)" htmlFor="airRateInsurer">
                <Input
                  id="airRateInsurer"
                  className="tabular text-right"
                  inputMode="decimal"
                  value={values.airRateInsurer}
                  onChange={(e) => set('airRateInsurer', e.target.value)}
                />
              </Field>
            </div>

            <div className="mt-5 space-y-3">
              <div className="flex items-center gap-2.5">
                <Switch
                  id="accessory"
                  checked={values.accessory}
                  onCheckedChange={(v) => set('accessory', v)}
                />
                <label htmlFor="accessory" className="cursor-pointer text-[14px] text-foreground">
                  Cobertura acessória
                  <span className="ml-1.5 text-[13px] text-muted-foreground">
                    (complementa a cláusula principal)
                  </span>
                </label>
              </div>
              <div className="flex items-center gap-2.5">
                <Switch id="active" checked={values.active} onCheckedChange={(v) => set('active', v)} />
                <label htmlFor="active" className="cursor-pointer text-[14px] text-foreground">
                  Ativa
                </label>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={save.isPending}>
              {isEditing ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
