import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Pencil, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Field } from '@/components/ui/field';
import { DataTable, type Column } from '@/components/ui/table';
import { EmptyState, Loading, LoadError } from '@/components/ui/states';
import {
  Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader,
} from '@/components/ui/dialog';
import { api, cleanPayload, errorMessage } from '@/lib/api';
import { useAuth } from '@/stores/auth';

interface Employee {
  id: string;
  name: string;
  email: string | null;
  department: string | null;
  jobTitle: string | null;
  isSalesperson: boolean;
  active: boolean;
}

export default function Employees() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Employee | null>(null);
  const [creating, setCreating] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['employees', search],
    queryFn: async () => {
      const { data } = await api.get('/employees', {
        params: { ...(search ? { search } : {}), perPage: 100 },
      });
      return data as { items: Employee[]; total: number };
    },
  });

  const items = data?.items ?? [];
  const canEdit = can('employee:update');

  const columns: Column<Employee>[] = [
    {
      key: 'name',
      header: 'Funcionário',
      render: (row) => (
        <div>
          <span className="block font-medium text-foreground">{row.name}</span>
          {row.email && (
            <span className="block text-[12.5px] text-muted-foreground">{row.email}</span>
          )}
        </div>
      ),
    },
    { key: 'department', header: 'Setor', render: (row) => row.department || '—' },
    { key: 'jobTitle', header: 'Função', render: (row) => row.jobTitle || '—' },
    {
      key: 'isSalesperson',
      header: 'Vendedor',
      width: '110px',
      render: (row) =>
        row.isSalesperson ? <Badge variant="info">Vendedor</Badge> : <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'active',
      header: 'Situação',
      width: '110px',
      render: (row) =>
        row.active ? <Badge variant="success" dot>Ativo</Badge> : <Badge variant="neutral">Inativo</Badge>,
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
          <h2 className="text-[18px] font-semibold tracking-tight text-foreground">Funcionários</h2>
          <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
            Equipe da corretora. Quem estiver marcado como vendedor aparece no select de comissão
            das cotações.
          </p>
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            Novo funcionário
          </Button>
        )}
      </header>

      <div className="relative mb-3 min-w-[240px] sm:max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, e-mail ou setor"
          className="h-9 pl-9"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
        {isLoading ? (
          <Loading />
        ) : isError ? (
          <LoadError message={errorMessage(error)} />
        ) : items.length === 0 ? (
          <EmptyState
            title="Nenhum funcionário cadastrado"
            description={search ? 'Ajuste a busca.' : 'Cadastre o primeiro funcionário.'}
          />
        ) : (
          <DataTable columns={columns} rows={items} rowKey={(r) => r.id} />
        )}
      </div>

      {(creating || editing) && (
        <EmployeeDialog
          employee={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ['employees'] })}
        />
      )}
    </div>
  );
}

function EmployeeDialog({
  employee,
  onClose,
  onSaved,
}: {
  employee: Employee | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = !!employee;
  const [values, setValues] = useState({
    name: employee?.name ?? '',
    email: employee?.email ?? '',
    department: employee?.department ?? '',
    jobTitle: employee?.jobTitle ?? '',
    isSalesperson: employee?.isSalesperson ?? false,
    active: employee?.active ?? true,
  });
  const [error, setError] = useState('');

  const set = (key: string, value: any) => setValues((v) => ({ ...v, [key]: value }));

  const save = useMutation({
    mutationFn: () => {
      const payload = cleanPayload(values);
      return isEditing
        ? api.patch(`/employees/${employee!.id}`, payload)
        : api.post('/employees', payload);
    },
    onSuccess: () => {
      toast.success(isEditing ? 'Funcionário atualizado.' : 'Funcionário cadastrado.');
      onSaved();
      onClose();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (values.name.trim().length < 3) {
      setError('Informe o nome completo.');
      return;
    }
    setError('');
    save.mutate();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader title={isEditing ? 'Editar funcionário' : 'Novo funcionário'} />
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
              <Field label="E-mail" htmlFor="email" className="sm:col-span-2">
                <Input
                  id="email"
                  type="email"
                  value={values.email}
                  onChange={(e) => set('email', e.target.value)}
                />
              </Field>
              <Field label="Setor" htmlFor="department">
                <Input
                  id="department"
                  placeholder="Seguro, Sinistro, Financeiro"
                  value={values.department}
                  onChange={(e) => set('department', e.target.value)}
                />
              </Field>
              <Field label="Função" htmlFor="jobTitle">
                <Input
                  id="jobTitle"
                  value={values.jobTitle}
                  onChange={(e) => set('jobTitle', e.target.value)}
                />
              </Field>
            </div>

            <div className="mt-5 space-y-3">
              <div className="flex items-center gap-2.5">
                <Switch
                  id="isSalesperson"
                  checked={values.isSalesperson}
                  onCheckedChange={(v) => set('isSalesperson', v)}
                />
                <label htmlFor="isSalesperson" className="cursor-pointer text-[14px] text-foreground">
                  É vendedor
                  <span className="ml-1.5 text-[13px] text-muted-foreground">
                    (aparece no select de comissão das cotações)
                  </span>
                </label>
              </div>
              <div className="flex items-center gap-2.5">
                <Switch id="active" checked={values.active} onCheckedChange={(v) => set('active', v)} />
                <label htmlFor="active" className="cursor-pointer text-[14px] text-foreground">
                  Ativo
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
