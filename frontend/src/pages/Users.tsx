import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { KeyRound, Plus, Search, UserCheck, UserX } from 'lucide-react';
import { Page } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { EmptyState, Loading, LoadError } from '@/components/ui/states';
import { api, errorMessage } from '@/lib/api';
import { formatDateTime, formatDocument, initials } from '@/lib/utils';
import { useAuth } from '@/stores/auth';
import { UserDialog } from '@/features/users/UserDialog';

export interface UserListItem {
  id: string;
  name: string;
  email: string;
  document: string | null;
  type: 'INTERNAL' | 'CLIENT' | 'PARTNER';
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED' | 'INVITED';
  phone: string | null;
  jobTitle: string | null;
  department: string | null;
  lastLoginAt: string | null;
  roles: { id: string; slug: string; name: string }[];
}

const STATUS_LABEL = {
  ACTIVE: { text: 'Ativo', variant: 'success' as const },
  INVITED: { text: 'Aguardando 1º acesso', variant: 'warning' as const },
  INACTIVE: { text: 'Inativo', variant: 'neutral' as const },
  BLOCKED: { text: 'Bloqueado', variant: 'danger' as const },
};

const TYPE_LABEL = { INTERNAL: 'Interno', CLIENT: 'Cliente', PARTNER: 'Parceiro' };

const STATUS_FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'ACTIVE', label: 'Ativos' },
  { value: 'INVITED', label: 'Pendentes' },
  { value: 'INACTIVE', label: 'Inativos' },
];

export default function Users() {
  const { can, user: me } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editing, setEditing] = useState<UserListItem | null>(null);
  const [creating, setCreating] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['users', search, statusFilter],
    queryFn: async () => {
      const { data } = await api.get('/users', {
        params: {
          ...(search ? { search } : {}),
          ...(statusFilter ? { status: statusFilter } : {}),
          perPage: 100,
        },
      });
      return data as { items: UserListItem[]; total: number };
    },
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.patch(`/users/${id}/status`, { active }),
    onSuccess: (_, { active }) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(active ? 'Usuário reativado.' : 'Usuário desativado.');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const resendAccess = useMutation({
    mutationFn: (id: string) => api.post(`/users/${id}/resend-access`),
    onSuccess: ({ data }) => toast.success(data.message),
    onError: (error) => toast.error(errorMessage(error)),
  });

  const items = data?.items ?? [];

  return (
    <Page
      title="Usuários"
      description="Quem acessa o sistema, com quais papéis e permissões."
      actions={
        can('user:create') && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            Novo usuário
          </Button>
        )
      }
    >
      {/* Filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[260px] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, e-mail ou CNPJ"
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-1 rounded-md border border-border bg-surface p-0.5">
          {STATUS_FILTERS.map((option) => (
            <button
              key={option.value}
              onClick={() => setStatusFilter(option.value)}
              className={`rounded px-3 py-1.5 text-[13px] font-medium transition-colors ${
                statusFilter === option.value
                  ? 'bg-navy/8 text-navy'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
        {isLoading ? (
          <Loading />
        ) : isError ? (
          <LoadError message={errorMessage(error)} />
        ) : items.length === 0 ? (
          <EmptyState
            title="Nenhum usuário encontrado"
            description={
              search || statusFilter
                ? 'Ajuste a busca ou os filtros para ver outros resultados.'
                : 'Cadastre o primeiro usuário para começar.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border bg-surface-alt/60">
                  {['Usuário', 'Papéis', 'Tipo', 'Status', 'Último acesso'].map((head) => (
                    <th
                      key={head}
                      className="px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {head}
                    </th>
                  ))}
                  <th className="w-px px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {items.map((u) => {
                  const status = STATUS_LABEL[u.status];
                  const isMe = u.id === me?.id;
                  return (
                    <tr
                      key={u.id}
                      className="border-b border-border transition-colors last:border-0 hover:bg-surface-alt/50"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-navy/8 text-[12px] font-semibold text-navy">
                            {initials(u.name)}
                          </span>
                          <div className="min-w-0">
                            <button
                              onClick={() => can('user:update') && setEditing(u)}
                              disabled={!can('user:update')}
                              className="block truncate text-[14px] font-medium text-foreground hover:text-navy disabled:cursor-default disabled:hover:text-foreground"
                            >
                              {u.name}
                              {isMe && (
                                <span className="ml-1.5 text-[12px] font-normal text-muted-foreground">
                                  (você)
                                </span>
                              )}
                            </button>
                            <span className="block truncate text-[13px] text-muted-foreground">
                              {u.email}
                              {u.document && ` · ${formatDocument(u.document)}`}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {u.roles.map((r) => (
                            <Badge key={r.id} variant="info">
                              {r.name}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[13.5px] text-muted-foreground">
                        {TYPE_LABEL[u.type]}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={status.variant} dot>
                          {status.text}
                        </Badge>
                      </td>
                      <td className="tabular px-4 py-3 text-[13.5px] text-muted-foreground">
                        {formatDateTime(u.lastLoginAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {can('user:reset_password') && u.status !== 'INACTIVE' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title={
                                u.status === 'INVITED'
                                  ? 'Reenviar convite de primeiro acesso'
                                  : 'Enviar link de redefinição de senha'
                              }
                              onClick={() => resendAccess.mutate(u.id)}
                              disabled={resendAccess.isPending}
                            >
                              <KeyRound className="h-4 w-4" />
                            </Button>
                          )}
                          {can('user:deactivate') && !isMe && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title={u.status === 'INACTIVE' ? 'Reativar usuário' : 'Desativar usuário'}
                              onClick={() =>
                                toggleStatus.mutate({ id: u.id, active: u.status === 'INACTIVE' })
                              }
                              disabled={toggleStatus.isPending}
                            >
                              {u.status === 'INACTIVE' ? (
                                <UserCheck className="h-4 w-4 text-success" />
                              ) : (
                                <UserX className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {data && items.length > 0 && (
        <p className="mt-3 text-[13px] text-muted-foreground">
          {data.total} usuário{data.total === 1 ? '' : 's'}
        </p>
      )}

      {(creating || editing) && (
        <UserDialog
          user={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </Page>
  );
}
