import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Lock, Plus, Save, Trash2, Users2 } from 'lucide-react';
import { Page } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loading, LoadError } from '@/components/ui/states';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/stores/auth';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { RoleDialog } from '@/features/roles/RoleDialog';

interface Role {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  system: boolean;
  permissions: string[];
  userCount: number;
}

interface PermissionGroup {
  module: string;
  permissions: { slug: string; resource: string; action: string; description: string | null }[];
}

/** Rótulos em português para os módulos técnicos (ver docs/07-modulos.md). */
const MODULE_LABEL: Record<string, string> = {
  auth: 'Acesso e usuários',
  partners: 'Cadastros de pessoas',
  catalog: 'Tabelas de domínio',
  policies: 'Apólices e tarifação',
  quotes: 'Cotações',
  endorsements: 'Averbações',
  documents: 'Documentos',
  finance: 'Financeiro',
  fx: 'Câmbio',
  reports: 'Relatórios',
};

export default function Roles() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Set<string> | null>(null);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState(false);

  const rolesQuery = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const { data } = await api.get('/roles');
      return data as Role[];
    },
  });

  const permissionsQuery = useQuery({
    queryKey: ['permissions'],
    queryFn: async () => {
      const { data } = await api.get('/roles/permissions');
      return data as PermissionGroup[];
    },
  });

  const roles = rolesQuery.data ?? [];
  const selected = roles.find((r) => r.id === selectedId) ?? roles[0] ?? null;

  // O rascunho só existe enquanto há edição pendente; fora isso, espelha o papel salvo.
  const current = draft ?? new Set(selected?.permissions ?? []);
  const isDirty = draft !== null;

  const save = useMutation({
    mutationFn: () =>
      api.patch(`/roles/${selected!.id}`, { permissions: [...current] }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setDraft(null);
      toast.success('Permissões atualizadas. As sessões deste papel foram encerradas.');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/roles/${selected!.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setSelectedId(null);
      setRemoving(false);
      toast.success('Papel excluído.');
    },
    onError: (error) => {
      setRemoving(false);
      toast.error(errorMessage(error));
    },
  });

  function toggle(slug: string) {
    const next = new Set(current);
    next.has(slug) ? next.delete(slug) : next.add(slug);
    setDraft(next);
  }

  function toggleModule(group: PermissionGroup) {
    const slugs = group.permissions.map((p) => p.slug);
    const allOn = slugs.every((s) => current.has(s));
    const next = new Set(current);
    slugs.forEach((s) => (allOn ? next.delete(s) : next.add(s)));
    setDraft(next);
  }

  function selectRole(id: string) {
    setSelectedId(id);
    setDraft(null);
  }

  if (rolesQuery.isLoading || permissionsQuery.isLoading) {
    return (
      <Page title="Papéis e permissões">
        <Loading />
      </Page>
    );
  }

  if (rolesQuery.isError) {
    return (
      <Page title="Papéis e permissões">
        <LoadError message={errorMessage(rolesQuery.error)} />
      </Page>
    );
  }

  return (
    <Page
      title="Papéis e permissões"
      description="Um papel agrupa permissões. Cada usuário recebe um ou mais papéis."
      actions={
        can('role:create') && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            Novo papel
          </Button>
        )
      }
    >
      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        {/* Lista de papéis */}
        <nav className="space-y-1.5">
          {roles.map((role) => (
            <button
              key={role.id}
              onClick={() => selectRole(role.id)}
              className={cn(
                'w-full rounded-lg border p-3.5 text-left transition-colors',
                selected?.id === role.id
                  ? 'border-navy/25 bg-navy/6'
                  : 'border-border bg-surface hover:border-border-strong hover:bg-surface-alt',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[14px] font-medium text-foreground">{role.name}</span>
                {role.system && (
                  <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Papel de sistema" />
                )}
              </div>
              <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground">
                {role.description}
              </p>
              <div className="mt-2 flex items-center gap-3 text-[12px] text-muted-foreground/80">
                <span>{role.permissions.length} permissões</span>
                <span className="flex items-center gap-1">
                  <Users2 className="h-3 w-3" />
                  {role.userCount}
                </span>
              </div>
            </button>
          ))}
        </nav>

        {/* Permissões do papel selecionado */}
        {selected && (
          <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-[16px] font-semibold text-foreground">{selected.name}</h2>
                  {selected.system && <Badge variant="neutral">Sistema</Badge>}
                </div>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  {current.size} de{' '}
                  {permissionsQuery.data?.reduce((acc, g) => acc + g.permissions.length, 0)} permissões
                </p>
              </div>

              {can('role:update') && (
                <div className="flex items-center gap-2">
                  {!selected.system && can('role:delete') && !isDirty && (
                    <Button
                      variant="ghost"
                      size="sm"
                      title={
                        selected.userCount > 0
                          ? 'Remova os usuários deste papel antes de excluir'
                          : 'Excluir papel'
                      }
                      onClick={() => setRemoving(true)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  {isDirty && (
                    <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
                      Descartar
                    </Button>
                  )}
                  <Button size="sm" disabled={!isDirty} loading={save.isPending} onClick={() => save.mutate()}>
                    <Save className="h-4 w-4" />
                    Salvar
                  </Button>
                </div>
              )}
            </header>

            {isDirty && (
              <p className="border-b border-warning/25 bg-warning/8 px-5 py-2.5 text-[13px] text-warning">
                Alterações não salvas. Salvar encerra as sessões ativas de quem tem este papel.
              </p>
            )}

            <div className="divide-y divide-border">
              {permissionsQuery.data?.map((group) => {
                const slugs = group.permissions.map((p) => p.slug);
                const onCount = slugs.filter((s) => current.has(s)).length;
                const allOn = onCount === slugs.length;

                return (
                  <section key={group.module} className="px-5 py-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {MODULE_LABEL[group.module] ?? group.module}
                      </h3>
                      {can('role:update') && (
                        <button
                          onClick={() => toggleModule(group)}
                          className="text-[12.5px] font-medium text-teal transition-colors hover:text-teal-hover"
                        >
                          {allOn ? 'Desmarcar todas' : 'Marcar todas'}
                        </button>
                      )}
                    </div>

                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {group.permissions.map((permission) => {
                        const on = current.has(permission.slug);
                        return (
                          <label
                            key={permission.slug}
                            className={cn(
                              'flex cursor-pointer items-start gap-2.5 rounded-md px-2.5 py-2 transition-colors',
                              can('role:update') ? 'hover:bg-surface-alt' : 'cursor-default',
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={on}
                              disabled={!can('role:update')}
                              onChange={() => toggle(permission.slug)}
                              className="mt-0.5 h-4 w-4 shrink-0 rounded border-border-strong text-teal focus:ring-2 focus:ring-ring/40"
                            />
                            <span className="min-w-0">
                              <span
                                className={cn(
                                  'block text-[13.5px]',
                                  on ? 'text-foreground' : 'text-muted-foreground',
                                )}
                              >
                                {permission.description}
                              </span>
                              <code className="mt-0.5 block text-[11.5px] text-muted-foreground/60">
                                {permission.slug}
                              </code>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {creating && <RoleDialog onClose={() => setCreating(false)} />}

      {removing && selected && (
        <ConfirmDialog
          title="Excluir papel?"
          description={`"${selected.name}" será removido permanentemente. Papéis atribuídos a algum usuário não podem ser excluídos.`}
          confirmLabel="Excluir"
          destructive
          loading={remove.isPending}
          onConfirm={() => remove.mutate()}
          onCancel={() => setRemoving(false)}
        />
      )}
    </Page>
  );
}
