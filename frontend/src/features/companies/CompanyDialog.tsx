import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check } from 'lucide-react';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Field } from '@/components/ui/field';
import { api, cleanPayload, errorMessage } from '@/lib/api';
import { formatDocument } from '@/lib/utils';
import { CompanyRole } from '@/lib/enums';
import type { Company } from './Companies';

type RoleKey = keyof typeof CompanyRole;

const ROLE_HINTS: Record<RoleKey, string> = {
  CLIENT: 'Segurado — contrata o seguro',
  PARTNER: 'Despachante ou agente de carga',
  INSURER: 'Emite as apólices',
  CARRIER: 'Transporta a carga',
  SURVEYOR: 'Realiza vistorias e regula sinistros',
};

export function CompanyDialog({
  company,
  onClose,
}: {
  company: Company | null;
  onClose: () => void;
}) {
  const isEditing = !!company;
  const queryClient = useQueryClient();

  const [values, setValues] = useState({
    legalName: company?.legalName ?? '',
    tradeName: company?.tradeName ?? '',
    document: company?.document ? formatDocument(company.document) : '',
    stateReg: company?.stateReg ?? '',
    email: company?.email ?? '',
    phone: company?.phone ?? '',
    mobile: company?.mobile ?? '',
    zipCode: company?.zipCode ?? '',
    address: company?.address ?? '',
    number: company?.number ?? '',
    district: company?.district ?? '',
    cityName: company?.cityName ?? '',
    stateName: company?.stateName ?? '',
    countryName: company?.countryName ?? 'Brasil',
    notes: company?.notes ?? '',
    active: company?.active ?? true,
  });

  const [roles, setRoles] = useState<RoleKey[]>(company?.roles ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (key: string, value: any) => setValues((v) => ({ ...v, [key]: value }));

  const save = useMutation({
    mutationFn: () => {
      const payload = cleanPayload({
        ...values,
        document: values.document.replace(/\D/g, '') || undefined,
        roles,
      });
      return isEditing
        ? api.patch(`/companies/${company!.id}`, payload)
        : api.post('/companies', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast.success(isEditing ? 'Empresa atualizada.' : 'Empresa cadastrada.');
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};

    if (values.legalName.trim().length < 2) found.legalName = 'Informe a razão social.';
    if (!roles.length) found.roles = 'Selecione ao menos um papel.';
    setErrors(found);
    if (Object.keys(found).length) return;

    save.mutate();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader
          title={isEditing ? 'Editar empresa' : 'Nova empresa'}
          description="Uma empresa pode acumular papéis — cliente e parceiro ao mesmo tempo, por exemplo."
        />

        <form onSubmit={submit} noValidate className="contents">
          <DialogBody>
            {/* Papéis primeiro: definem como a empresa aparece nas cotações */}
            <div className="mb-6">
              <p className="field-label">
                Papéis<span className="ml-0.5 text-danger">*</span>
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                {(Object.keys(CompanyRole) as RoleKey[]).map((key) => {
                  const selected = roles.includes(key);
                  return (
                    <button
                      type="button"
                      key={key}
                      onClick={() =>
                        setRoles((current) =>
                          selected ? current.filter((r) => r !== key) : [...current, key],
                        )
                      }
                      className={`flex items-start gap-2 rounded-md border p-2.5 text-left transition-colors ${
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
                        <span className="block text-[13.5px] font-medium text-foreground">
                          {CompanyRole[key]}
                        </span>
                        <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">
                          {ROLE_HINTS[key]}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {errors.roles && <p className="field-error">{errors.roles}</p>}
            </div>

            {/* Identificação */}
            <div className="grid gap-4 sm:grid-cols-6">
              <Field
                label="Razão social"
                htmlFor="legalName"
                required
                error={errors.legalName}
                className="sm:col-span-4"
              >
                <Input
                  id="legalName"
                  autoFocus
                  value={values.legalName}
                  invalid={!!errors.legalName}
                  onChange={(e) => set('legalName', e.target.value)}
                />
              </Field>

              <Field label="CNPJ/CPF" htmlFor="document" className="sm:col-span-2">
                <Input
                  id="document"
                  value={values.document}
                  placeholder="00.000.000/0000-00"
                  onChange={(e) => set('document', e.target.value)}
                />
              </Field>

              <Field label="Nome fantasia" htmlFor="tradeName" className="sm:col-span-4">
                <Input
                  id="tradeName"
                  value={values.tradeName}
                  onChange={(e) => set('tradeName', e.target.value)}
                />
              </Field>

              <Field label="Inscrição estadual" htmlFor="stateReg" className="sm:col-span-2">
                <Input
                  id="stateReg"
                  value={values.stateReg}
                  onChange={(e) => set('stateReg', e.target.value)}
                />
              </Field>

              <Field label="E-mail" htmlFor="email" className="sm:col-span-3">
                <Input
                  id="email"
                  type="email"
                  value={values.email}
                  onChange={(e) => set('email', e.target.value)}
                />
              </Field>

              <Field label="Telefone" htmlFor="phone" className="sm:col-span-3">
                <Input
                  id="phone"
                  value={values.phone}
                  onChange={(e) => set('phone', e.target.value)}
                />
              </Field>
            </div>

            {/* Endereço */}
            <p className="mb-3 mt-6 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
              Endereço
            </p>
            <div className="grid gap-4 sm:grid-cols-6">
              <Field label="CEP" htmlFor="zipCode" className="sm:col-span-2">
                <Input
                  id="zipCode"
                  value={values.zipCode}
                  placeholder="00000-000"
                  onChange={(e) => set('zipCode', e.target.value)}
                />
              </Field>

              <Field label="Logradouro" htmlFor="address" className="sm:col-span-3">
                <Input
                  id="address"
                  value={values.address}
                  onChange={(e) => set('address', e.target.value)}
                />
              </Field>

              <Field label="Número" htmlFor="number" className="sm:col-span-1">
                <Input
                  id="number"
                  value={values.number}
                  onChange={(e) => set('number', e.target.value)}
                />
              </Field>

              <Field label="Bairro" htmlFor="district" className="sm:col-span-2">
                <Input
                  id="district"
                  value={values.district}
                  onChange={(e) => set('district', e.target.value)}
                />
              </Field>

              <Field label="Cidade" htmlFor="cityName" className="sm:col-span-2">
                <Input
                  id="cityName"
                  value={values.cityName}
                  onChange={(e) => set('cityName', e.target.value)}
                />
              </Field>

              <Field label="Estado" htmlFor="stateName" className="sm:col-span-1">
                <Input
                  id="stateName"
                  value={values.stateName}
                  onChange={(e) => set('stateName', e.target.value)}
                />
              </Field>

              <Field label="País" htmlFor="countryName" className="sm:col-span-1">
                <Input
                  id="countryName"
                  value={values.countryName}
                  onChange={(e) => set('countryName', e.target.value)}
                />
              </Field>

              <Field label="Observações" htmlFor="notes" className="sm:col-span-6">
                <Input
                  id="notes"
                  value={values.notes}
                  onChange={(e) => set('notes', e.target.value)}
                />
              </Field>
            </div>

            <div className="mt-6 flex items-center gap-2.5">
              <Switch
                id="active"
                checked={values.active}
                onCheckedChange={(v) => set('active', v)}
              />
              <label htmlFor="active" className="cursor-pointer text-[14px] text-foreground">
                Empresa ativa
              </label>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={save.isPending}>
              {isEditing ? 'Salvar alterações' : 'Cadastrar empresa'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
