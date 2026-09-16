import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Loading } from '@/components/ui/states';
import { api, errorMessage } from '@/lib/api';

interface PermissionGroup {
  module: string;
  permissions: { slug: string; description: string | null }[];
}

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

export function RoleDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: groups, isLoading } = useQuery({
    queryKey: ['permissions'],
    queryFn: async () => {
      const { data } = await api.get('/roles/permissions');
      return data as PermissionGroup[];
    },
  });

  const create = useMutation({
    mutationFn: () =>
      api.post('/roles', {
        name,
        description: description || undefined,
        permissions: [...selected],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast.success('Papel criado.');
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  function toggle(slug: string) {
    setSelected((current) => {
      const next = new Set(current);
      next.has(slug) ? next.delete(slug) : next.add(slug);
      return next;
    });
  }

  function toggleModule(group: PermissionGroup) {
    const slugs = group.permissions.map((p) => p.slug);
    const allOn = slugs.every((s) => selected.has(s));
    setSelected((current) => {
      const next = new Set(current);
      slugs.forEach((s) => (allOn ? next.delete(s) : next.add(s)));
      return next;
    });
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (name.trim().length < 3) found.name = 'Informe o nome do papel.';
    if (selected.size === 0) found.permissions = 'Selecione ao menos uma permissão.';
    setErrors(found);
    if (Object.keys(found).length) return;
    create.mutate();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader
          title="Novo papel"
          description="Agrupe as permissões que esse conjunto de pessoas precisa."
        />

        <form onSubmit={submit} noValidate className="contents">
          <DialogBody>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Nome" htmlFor="roleName" required error={errors.name}>
                <Input
                  id="roleName"
                  autoFocus
                  placeholder="Ex.: Sinistro"
                  value={name}
                  invalid={!!errors.name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field label="Descrição" htmlFor="roleDescription" className="sm:col-span-2">
                <Input
                  id="roleDescription"
                  placeholder="O que esse papel faz no dia a dia"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </Field>
            </div>

            <div className="mt-6">
              <p className="field-label">
                Permissões<span className="ml-0.5 text-danger">*</span>
                <span className="ml-2 font-normal text-muted-foreground">
                  {selected.size} selecionada{selected.size === 1 ? '' : 's'}
                </span>
              </p>

              {isLoading ? (
                <Loading text="Carregando permissões…" />
              ) : (
                <div className="divide-y divide-border rounded-lg border border-border">
                  {groups?.map((group) => {
                    const slugs = group.permissions.map((p) => p.slug);
                    const allOn = slugs.every((s) => selected.has(s));
                    return (
                      <section key={group.module} className="px-4 py-3">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {MODULE_LABEL[group.module] ?? group.module}
                          </h3>
                          <button
                            type="button"
                            onClick={() => toggleModule(group)}
                            className="text-[12.5px] font-medium text-teal transition-colors hover:text-teal-hover"
                          >
                            {allOn ? 'Desmarcar todas' : 'Marcar todas'}
                          </button>
                        </div>
                        <div className="grid gap-1.5 sm:grid-cols-2">
                          {group.permissions.map((permission) => (
                            <label
                              key={permission.slug}
                              className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 transition-colors hover:bg-surface-alt"
                            >
                              <input
                                type="checkbox"
                                checked={selected.has(permission.slug)}
                                onChange={() => toggle(permission.slug)}
                                className="mt-0.5 h-4 w-4 shrink-0 rounded border-border-strong text-teal focus:ring-2 focus:ring-ring/40"
                              />
                              <span className="min-w-0">
                                <span className="block text-[13.5px] text-foreground">
                                  {permission.description}
                                </span>
                                <code className="block text-[11.5px] text-muted-foreground/60">
                                  {permission.slug}
                                </code>
                              </span>
                            </label>
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}

              {errors.permissions && <p className="field-error">{errors.permissions}</p>}
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={create.isPending}>
              Criar papel
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
