import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/ui/table';
import { EmptyState, Loading, LoadError } from '@/components/ui/states';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { api, errorMessage } from '@/lib/api';
import { formatDocument } from '@/lib/utils';
import { CompanyRole } from '@/lib/enums';
import { useAuth } from '@/stores/auth';
import { CompanyDialog } from './CompanyDialog';

export interface Company {
  id: string;
  legalName: string;
  tradeName: string | null;
  document: string | null;
  email: string | null;
  phone: string | null;
  cityName: string | null;
  stateName: string | null;
  active: boolean;
  roles: Array<keyof typeof CompanyRole>;
  [key: string]: any;
}

const ROLE_FILTERS = [
  { value: '', label: 'Todas' },
  { value: 'CLIENT', label: 'Clientes' },
  { value: 'PARTNER', label: 'Parceiros' },
  { value: 'INSURER', label: 'Seguradoras' },
  { value: 'CARRIER', label: 'Transportadoras' },
  { value: 'SURVEYOR', label: 'Vistoriadores' },
];

export default function Companies() {
  const { can } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [editing, setEditing] = useState<Company | null>(null);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<Company | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['companies', search, role],
    queryFn: async () => {
      const { data } = await api.get('/companies', {
        params: { ...(search ? { search } : {}), ...(role ? { role } : {}), perPage: 100 },
      });
      return data as { items: Company[]; total: number };
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/companies/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setRemoving(null);
      toast.success('Empresa excluída.');
    },
    onError: (error) => {
      setRemoving(null);
      toast.error(errorMessage(error));
    },
  });

  const items = data?.items ?? [];
  const canEdit = can('company:update');

  const columns: Column<Company>[] = [
    {
      key: 'name',
      header: 'Empresa',
      render: (row) => (
        <div className="min-w-0">
          <span className="block truncate font-medium text-foreground">
            {row.tradeName || row.legalName}
          </span>
          <span className="block truncate text-[12.5px] text-muted-foreground">
            {row.tradeName ? row.legalName : formatDocument(row.document)}
          </span>
        </div>
      ),
    },
    {
      key: 'document',
      header: 'CNPJ/CPF',
      width: '160px',
      render: (row) => <span className="tabular">{formatDocument(row.document)}</span>,
    },
    {
      key: 'roles',
      header: 'Papéis',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.roles.map((r) => (
            <Badge key={r} variant="info">
              {CompanyRole[r]}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'location',
      header: 'Local',
      render: (row) =>
        row.cityName ? `${row.cityName}${row.stateName ? ` · ${row.stateName}` : ''}` : '—',
    },
    {
      key: 'status',
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
      width: '90px',
      render: (row) => (
        <div className="flex items-center justify-end gap-0.5">
          <Button variant="ghost" size="icon" title="Editar" onClick={() => setEditing(row)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          {can('company:delete') && (
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
          <h2 className="text-[18px] font-semibold tracking-tight text-foreground">Empresas</h2>
          <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
            Clientes, parceiros, seguradoras, transportadoras e vistoriadores em um cadastro só.
            Uma mesma empresa pode ter vários papéis — no legado ela precisava ser duplicada.
          </p>
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            Nova empresa
          </Button>
        )}
      </header>

      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[240px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, CNPJ ou e-mail"
            className="h-9 pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-surface p-0.5">
          {ROLE_FILTERS.map((option) => (
            <button
              key={option.value}
              onClick={() => setRole(option.value)}
              className={`rounded px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
                role === option.value
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
            title="Nenhuma empresa encontrada"
            description={
              search || role ? 'Ajuste a busca ou o filtro.' : 'Cadastre a primeira empresa.'
            }
            action={
              canEdit && !search && !role ? (
                <Button size="sm" onClick={() => setCreating(true)}>
                  <Plus className="h-4 w-4" />
                  Nova empresa
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
          {data.total} empresa{data.total === 1 ? '' : 's'}
        </p>
      )}

      {(creating || editing) && (
        <CompanyDialog
          company={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      {removing && (
        <ConfirmDialog
          title="Excluir empresa?"
          description={`"${removing.legalName}" será removida permanentemente. Empresas com cotações ou apólices vinculadas não podem ser excluídas — nesse caso, desative-a.`}
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
