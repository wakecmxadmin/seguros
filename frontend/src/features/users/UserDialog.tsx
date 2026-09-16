import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { AlertCircle, Check, Mail } from 'lucide-react';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Field } from '@/components/ui/field';
import { Loading } from '@/components/ui/states';
import { api, errorMessage } from '@/lib/api';
import { formatDocument } from '@/lib/utils';
import type { UserListItem } from '@/pages/Users';

const schema = z.object({
  name: z.string().min(3, 'Informe o nome completo.'),
  email: z.string().min(1, 'Informe o e-mail.').email('E-mail inválido.'),
  document: z.string().optional(),
  type: z.enum(['INTERNAL', 'CLIENT', 'PARTNER']),
  jobTitle: z.string().optional(),
  department: z.string().optional(),
  phone: z.string().optional(),
  roleIds: z.array(z.string()).min(1, 'Selecione ao menos um papel.'),
});

type FormValues = z.infer<typeof schema>;

interface RoleOption {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  permissions: string[];
}

interface UserDialogProps {
  /** `null` cria um novo usuário. */
  user: UserListItem | null;
  onClose: () => void;
}

export function UserDialog({ user, onClose }: UserDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = !!user;

  const { data: roles, isLoading: loadingRoles } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const { data } = await api.get('/roles');
      return data as RoleOption[];
    },
  });

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: user?.name ?? '',
      email: user?.email ?? '',
      document: user?.document ? formatDocument(user.document) : '',
      type: user?.type ?? 'INTERNAL',
      jobTitle: user?.jobTitle ?? '',
      department: user?.department ?? '',
      phone: user?.phone ?? '',
      roleIds: user?.roles.map((r) => r.id) ?? [],
    },
  });

  const type = watch('type');

  const save = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        ...values,
        document: values.document?.replace(/\D/g, '') || undefined,
        jobTitle: values.jobTitle || undefined,
        department: values.department || undefined,
        phone: values.phone || undefined,
      };
      return isEditing ? api.patch(`/users/${user.id}`, payload) : api.post('/users', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(
        isEditing ? 'Usuário atualizado.' : 'Usuário criado. Enviamos o convite por e-mail.',
      );
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader
          title={isEditing ? 'Editar usuário' : 'Novo usuário'}
          description={
            isEditing
              ? 'Alterações nos papéis encerram as sessões ativas deste usuário.'
              : 'O usuário receberá um e-mail para definir a própria senha.'
          }
        />

        <form onSubmit={handleSubmit((v) => save.mutate(v))} noValidate className="contents">
          <DialogBody>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Nome completo"
                htmlFor="name"
                required
                error={errors.name?.message}
                className="sm:col-span-2"
              >
                <Input id="name" autoFocus invalid={!!errors.name} {...register('name')} />
              </Field>

              <Field label="E-mail" htmlFor="email" required error={errors.email?.message}>
                <Input
                  id="email"
                  type="email"
                  placeholder="nome@empresa.com.br"
                  invalid={!!errors.email}
                  {...register('email')}
                />
              </Field>

              <Field label="Tipo de acesso" htmlFor="type" required>
                <Select id="type" {...register('type')}>
                  <option value="INTERNAL">Interno (equipe Pinho)</option>
                  <option value="CLIENT">Cliente</option>
                  <option value="PARTNER">Parceiro</option>
                </Select>
              </Field>

              <Field
                label="CNPJ/CPF"
                htmlFor="document"
                error={errors.document?.message}
                hint={
                  type !== 'INTERNAL'
                    ? 'Era o login no sistema antigo; ajuda a vincular o cadastro.'
                    : undefined
                }
              >
                <Input id="document" placeholder="00.000.000/0000-00" {...register('document')} />
              </Field>

              <Field label="Telefone" htmlFor="phone">
                <Input id="phone" placeholder="(41) 0000-0000" {...register('phone')} />
              </Field>

              <Field label="Cargo" htmlFor="jobTitle">
                <Input id="jobTitle" placeholder="Ex.: Analista de Seguros" {...register('jobTitle')} />
              </Field>

              <Field label="Setor" htmlFor="department">
                <Input id="department" placeholder="Ex.: Seguro, Sinistro, Financeiro" {...register('department')} />
              </Field>
            </div>

            {/* Papéis */}
            <div className="mt-6">
              <p className="field-label">
                Papéis<span className="ml-0.5 text-danger">*</span>
              </p>
              <p className="mb-3 text-[13px] text-muted-foreground">
                Definem o que a pessoa pode ver e fazer. Veja o detalhe de cada um em
                “Papéis e permissões”.
              </p>

              {loadingRoles ? (
                <Loading text="Carregando papéis…" />
              ) : (
                <Controller
                  control={control}
                  name="roleIds"
                  render={({ field }) => (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {roles?.map((role) => {
                        const selected = field.value.includes(role.id);
                        return (
                          <button
                            type="button"
                            key={role.id}
                            onClick={() =>
                              field.onChange(
                                selected
                                  ? field.value.filter((id) => id !== role.id)
                                  : [...field.value, role.id],
                              )
                            }
                            className={`flex items-start gap-2.5 rounded-md border p-3 text-left transition-colors ${
                              selected
                                ? 'border-teal bg-teal/6'
                                : 'border-border hover:border-border-strong hover:bg-surface-alt'
                            }`}
                          >
                            <span
                              className={`mt-px grid h-4 w-4 shrink-0 place-items-center rounded border transition-colors ${
                                selected ? 'border-teal bg-teal text-white' : 'border-border-strong'
                              }`}
                            >
                              {selected && <Check className="h-3 w-3" strokeWidth={3} />}
                            </span>
                            <span className="min-w-0">
                              <span className="block text-[14px] font-medium text-foreground">
                                {role.name}
                              </span>
                              <span className="mt-0.5 block text-[12.5px] leading-snug text-muted-foreground">
                                {role.description}
                              </span>
                              <span className="mt-1 block text-[12px] text-muted-foreground/70">
                                {role.permissions.length} permissões
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                />
              )}

              {errors.roleIds && (
                <p className="field-error">
                  <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
                  <span>{errors.roleIds.message}</span>
                </p>
              )}
            </div>

            {!isEditing && (
              <div className="mt-5 flex items-start gap-2.5 rounded-md border border-border bg-surface-alt px-3.5 py-3">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-teal" />
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  Ao salvar, enviaremos um convite para o usuário definir a própria senha. Ele fica
                  como <strong className="text-foreground">Aguardando 1º acesso</strong> até concluir.
                </p>
              </div>
            )}
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={isSubmitting || save.isPending}>
              {isEditing ? 'Salvar alterações' : 'Criar e enviar convite'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
