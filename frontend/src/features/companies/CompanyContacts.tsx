import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/stores/auth';

interface Contact {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  department: string | null;
}

const EMPTY = { name: '', phone: '', email: '', department: '' };

/**
 * Contatos da empresa — a aba "Contatos Gerais" de Transportadoras do legado
 * (nome, telefone, e-mail, setor), disponível para qualquer papel.
 */
export function CompanyContacts({ companyId }: { companyId: string }) {
  const { can } = useAuth();
  const canEdit = can('company:update');
  const queryClient = useQueryClient();
  const queryKey = ['company-contacts', companyId];

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<typeof EMPTY | null>(null);

  const { data: contacts = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => (await api.get(`/companies/${companyId}/contacts`)).data as Contact[],
  });

  const close = () => {
    setForm(null);
    setEditingId(null);
  };

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: form!.name.trim(),
        phone: form!.phone.trim() || undefined,
        email: form!.email.trim() || undefined,
        department: form!.department.trim() || undefined,
      };
      return editingId
        ? api.patch(`/companies/${companyId}/contacts/${editingId}`, payload)
        : api.post(`/companies/${companyId}/contacts`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success(editingId ? 'Contato atualizado.' : 'Contato adicionado.');
      close();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/companies/${companyId}/contacts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Contato removido.');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  function submit() {
    if (!form || form.name.trim().length < 2) {
      toast.error('Informe o nome do contato.');
      return;
    }
    save.mutate();
  }

  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
          Contatos
        </p>
        {canEdit && !form && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setEditingId(null);
              setForm(EMPTY);
            }}
          >
            <Plus className="h-4 w-4" />
            Novo contato
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-md border border-border">
        {isLoading ? (
          <p className="px-3 py-3 text-[13px] text-muted-foreground">Carregando…</p>
        ) : contacts.length === 0 && !form ? (
          <p className="px-3 py-3 text-[13px] text-muted-foreground">Nenhum contato cadastrado.</p>
        ) : (
          <table className="w-full text-[13.5px]">
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-medium text-foreground">{c.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{c.department ?? '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{c.phone ?? '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{c.email ?? '—'}</td>
                  <td className="w-[88px] whitespace-nowrap px-2 py-1 text-right">
                    {canEdit && (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          title="Editar"
                          onClick={() => {
                            setEditingId(c.id);
                            setForm({
                              name: c.name,
                              phone: c.phone ?? '',
                              email: c.email ?? '',
                              department: c.department ?? '',
                            });
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          title="Remover"
                          disabled={remove.isPending}
                          onClick={() => remove.mutate(c.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {form && (
          <div
            className="grid gap-2 border-t border-border bg-surface-alt p-3 sm:grid-cols-[1.3fr_1fr_1fr_1.3fr_auto]"
            onKeyDown={(e) => {
              // Enter salva o contato sem submeter o formulário da empresa.
              if (e.key === 'Enter') {
                e.preventDefault();
                submit();
              }
            }}
          >
            <Input
              autoFocus
              placeholder="Nome"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Input
              placeholder="Setor"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
            />
            <Input
              placeholder="Telefone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <Input
              type="email"
              placeholder="E-mail"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <div className="flex gap-1">
              <Button type="button" size="sm" loading={save.isPending} onClick={submit}>
                {editingId ? 'Salvar' : 'Adicionar'}
              </Button>
              <Button type="button" size="icon" variant="ghost" title="Cancelar" onClick={close}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
