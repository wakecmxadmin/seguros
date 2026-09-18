import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Field } from '@/components/ui/field';
import { Combobox } from '@/components/ui/combobox';
import { api } from '@/lib/api';
import { SigraPullPanel } from '../SigraPullPanel';
import { SectionTitle, type StepProps } from './types';

export function StepIdentification({
  values, set, errors, initialLabels, isEditing, sigraDraft, onSigraLinked,
}: StepProps) {
  const { data: policies } = useQuery({
    queryKey: ['policy-options', values.kind, values.insurerId],
    queryFn: async () => {
      const { data } = await api.get('/policies/options', {
        params: { kind: values.kind, ...(values.insurerId ? { insurerId: values.insurerId } : {}) },
      });
      return data as Array<{
        id: string; label: string; sublabel: string; insurerId: string;
        baseRateClient: string; baseRateInsurer: string; minimumPremium: string;
      }>;
    },
  });

  /**
   * Escolher a apólice preenche seguradora, taxas e prêmio mínimo — no legado
   * essas informações estavam no nome da apólice ou em lugar nenhum.
   */
  function selectPolicy(policyId: string) {
    set('policyId', policyId || null);
    const policy = policies?.find((p) => p.id === policyId);
    if (!policy) return;

    set('insurerId', policy.insurerId);
    set('clientBaseRate', Number(policy.baseRateClient).toFixed(5).replace('.', ','));
    set('insurerBaseRate', Number(policy.baseRateInsurer).toFixed(5).replace('.', ','));
    set('minimumPremium', Number(policy.minimumPremium).toFixed(2).replace('.', ','));
  }

  return (
    <div>
      {!isEditing && values.kind === 'IMPORT' && (
        <>
          <SectionTitle>Importar do SIGRA</SectionTitle>
          <SigraPullPanel linked={sigraDraft ?? null} set={set} onLinked={onSigraLinked!} />
        </>
      )}

      <SectionTitle>Processo</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Data" htmlFor="issueDate">
          <Input
            id="issueDate"
            type="date"
            value={values.issueDate}
            onChange={(e) => set('issueDate', e.target.value)}
          />
        </Field>

        <Field
          label="Data limite de pendência"
          htmlFor="pendingLimitDate"
          hint="Prazo para regularizar."
        >
          <Input
            id="pendingLimitDate"
            type="date"
            value={values.pendingLimitDate}
            onChange={(e) => set('pendingLimitDate', e.target.value)}
          />
        </Field>

        <Field label="Apólice" htmlFor="policyId" className="sm:col-span-2">
          <Select
            id="policyId"
            value={values.policyId ?? ''}
            onChange={(e) => selectPolicy(e.target.value)}
          >
            <option value="">Selecione…</option>
            {policies?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} — {p.sublabel}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <SectionTitle>Partes</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cliente" required error={errors.clientId}>
          <Combobox
            endpoint="/companies/options"
            params={{ role: 'CLIENT' }}
            value={values.clientId}
            selectedLabel={initialLabels?.client ?? null}
            invalid={!!errors.clientId}
            placeholder="Buscar por nome ou CNPJ"
            emptyMessage="Nenhuma empresa com papel de cliente."
            onChange={(id, option) => {
              set('clientId', id);
              if (option && !values.contactName) set('contactName', '');
            }}
          />
        </Field>

        <Field label="Parceiro" hint="Despachante ou agente de carga.">
          <Combobox
            endpoint="/companies/options"
            params={{ role: 'PARTNER' }}
            value={values.partnerId}
            selectedLabel={initialLabels?.partner ?? null}
            placeholder="Buscar parceiro"
            emptyMessage="Nenhuma empresa com papel de parceiro."
            onChange={(id) => set('partnerId', id)}
          />
        </Field>
      </div>

      {values.kind === 'IMPORT' && (
        <div className="mt-4 flex items-center gap-2.5">
          <Switch
            id="singleProvisional"
            checked={values.singleProvisional}
            onCheckedChange={(v) => set('singleProvisional', v)}
          />
          <label htmlFor="singleProvisional" className="cursor-pointer text-[14px] text-foreground">
            Provisória única
          </label>
        </div>
      )}

      <SectionTitle>Contato</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Nome" htmlFor="contactName">
          <Input
            id="contactName"
            value={values.contactName}
            onChange={(e) => set('contactName', e.target.value)}
          />
        </Field>
        <Field label="Telefone" htmlFor="contactPhone">
          <Input
            id="contactPhone"
            value={values.contactPhone}
            onChange={(e) => set('contactPhone', e.target.value)}
          />
        </Field>
        <Field label="E-mail" htmlFor="contactEmail">
          <Input
            id="contactEmail"
            type="email"
            value={values.contactEmail}
            onChange={(e) => set('contactEmail', e.target.value)}
          />
        </Field>
      </div>
    </div>
  );
}
