import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/ui/table';
import { EmptyState, Loading, LoadError } from '@/components/ui/states';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { api, errorMessage } from '@/lib/api';
import { formatRate } from '@/lib/format';
import { useAuth } from '@/stores/auth';
import { CATALOGS, type CatalogConfig } from './config';
import { CatalogFormDialog } from './CatalogFormDialog';

interface Row {
  id: string;
  active: boolean;
  [key: string]: any;
}

/** Listagem + formulário de qualquer tabela de domínio, montados a partir dos metadados. */
export function CatalogCrud({ config }: { config: CatalogConfig }) {
  const { can } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [parentId, setParentId] = useState('');
  const [editing, setEditing] = useState<Row | null>(null);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<Row | null>(null);

  const listKey = ['catalog', config.key, search, parentId];

  const { data, isLoading, isError, error } = useQuery({
    queryKey: listKey,
    queryFn: async () => {
      const { data } = await api.get(`/catalog/${config.key}`, {
        params: { ...(search ? { search } : {}), ...(parentId ? { parentId } : {}), perPage: 200 },
      });
      return data as { items: Row[]; total: number };
    },
  });

  // Opções do filtro por entidade pai (país → estados, estado → cidades).
  const { data: parentOptions } = useQuery({
    queryKey: ['catalog-options', config.parentFilter?.catalog],
    queryFn: async () => {
      const { data } = await api.get(`/catalog/${config.parentFilter!.catalog}/options`);
      return data as Array<{ id: string; label: string }>;
    },
    enabled: !!config.parentFilter,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/catalog/${config.key}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog', config.key] });
      setRemoving(null);
      toast.success(`${config.label} excluído.`);
    },
    onError: (error) => {
      setRemoving(null);
      toast.error(errorMessage(error));
    },
  });

  const items = data?.items ?? [];
  const canEdit = can('catalog:update');

  const columns: Column<Row>[] = [
    ...config.fields
      .filter((f) => f.inTable)
      .map<Column<Row>>((field) => ({
        key: field.name,
        header: field.label,
        numeric: field.numeric,
        render: (row) => {
          const value = row[field.name];

          if (field.type === 'rate') return formatRate(value);

          if (field.type === 'select') {
            // Relações vêm expandidas pelo backend (country, state, city).
            const relation = field.name.replace(/Id$/, '');
            if (row[relation]?.name) return row[relation].name;
            if (field.options) {
              return field.options.find((o) => o.value === value)?.label ?? '—';
            }
          }

          return value === null || value === undefined || value === '' ? '—' : String(value);
        },
      })),
    {
      key: 'status',
      header: 'Situação',
      width: '110px',
      render: (row) =>
        row.active ? (
          <Badge variant="success" dot>
            Ativo
          </Badge>
        ) : (
          <Badge variant="neutral">Inativo</Badge>
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
          {can('catalog:delete') && (
            <Button variant="ghost" size="icon" title="Excluir" onClick={() => setRemoving(row)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ),
    });
  }

  return (
    <div>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-[18px] font-semibold tracking-tight text-foreground">
            {config.plural}
          </h2>
          <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
            {config.description}
          </p>
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            Adicionar
          </Button>
        )}
      </header>

      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[240px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Buscar ${config.plural.toLowerCase()}`}
            className="h-9 pl-9"
          />
        </div>

        {config.parentFilter && (
          <Select
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            className="h-9 w-auto min-w-[190px]"
          >
            <option value="">Todos — {config.parentFilter.label}</option>
            {parentOptions?.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
        {isLoading ? (
          <Loading />
        ) : isError ? (
          <LoadError message={errorMessage(error)} />
        ) : items.length === 0 ? (
          <EmptyState
            title={`Nenhum registro em ${config.plural.toLowerCase()}`}
            description={
              search || parentId
                ? 'Ajuste a busca ou o filtro.'
                : canEdit
                  ? 'Adicione o primeiro registro.'
                  : undefined
            }
            action={
              canEdit && !search && !parentId ? (
                <Button size="sm" onClick={() => setCreating(true)}>
                  <Plus className="h-4 w-4" />
                  Adicionar
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
          {data.total} registro{data.total === 1 ? '' : 's'}
        </p>
      )}

      {(creating || editing) && (
        <CatalogFormDialog
          config={config}
          record={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ['catalog', config.key] })}
        />
      )}

      {removing && (
        <ConfirmDialog
          title={`Excluir ${config.label.toLowerCase()}?`}
          description={`"${removing.name ?? removing.code}" será removido permanentemente. Se estiver em uso por alguma cotação, prefira desativá-lo.`}
          confirmLabel="Excluir"
          destructive
          loading={remove.isPending}
          onConfirm={() => remove.mutate(removing.id)}
          onCancel={() => setRemoving(null)}
        />
      )}
    </div>
  );
}

export { CATALOGS };
