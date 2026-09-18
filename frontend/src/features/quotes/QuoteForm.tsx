import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Check, Save } from 'lucide-react';
import { Page } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Loading, LoadError } from '@/components/ui/states';
import { api, errorMessage } from '@/lib/api';
import { formatMoney, formatRate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { QuoteKind } from '@/lib/enums';
import { QuoteSummary } from './QuoteSummary';
import {
  emptyQuote,
  toPayload,
  useQuoteCalculation,
  type QuoteFormValues,
} from './useQuoteForm';
import { StepIdentification } from './steps/StepIdentification';
import { StepRoute } from './steps/StepRoute';
import { StepCargo } from './steps/StepCargo';
import { StepFinancial } from './steps/StepFinancial';
import { StepRates } from './steps/StepRates';
import { CommunicationPanel } from './communications/CommunicationPanel';
import type { SigraDraft } from './SigraPullPanel';

const STEPS = [
  { key: 'identification', label: 'Identificação' },
  { key: 'route', label: 'Rota' },
  { key: 'cargo', label: 'Carga' },
  { key: 'financial', label: 'Financeiro' },
  { key: 'rates', label: 'Taxas e prêmio' },
] as const;

/** Só existe depois que o processo tem um id — precisa de algo para anexar a mensagem. */
const COMMUNICATION_STEP = { key: 'communication', label: 'Comunicação' } as const;

export default function QuoteForm() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditing = !!id;

  const kindParam = (params.get('kind') as 'IMPORT' | 'EXPORT') ?? 'IMPORT';
  const [values, setValues] = useState<QuoteFormValues>(() => emptyQuote(kindParam));
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sigraDraft, setSigraDraft] = useState<SigraDraft | null>(null);

  const set = <K extends keyof QuoteFormValues>(key: K, value: QuoteFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  // Carrega a cotação em edição.
  const { data: existing, isLoading, isError, error } = useQuery({
    queryKey: ['quote', id],
    queryFn: async () => {
      const { data } = await api.get(`/quotes/${id}`);
      return data;
    },
    enabled: isEditing,
  });

  useEffect(() => {
    if (!existing) return;
    const line = (item: string) =>
      existing.rateLines?.find((l: any) => l.item === item);
    const cost = line('COST');

    setValues({
      ...emptyQuote(existing.kind),
      kind: existing.kind,
      modal: existing.modal,
      issueDate: existing.issueDate?.slice(0, 10) ?? '',
      pendingLimitDate: existing.pendingLimitDate?.slice(0, 10) ?? '',
      policyId: existing.policyId,
      insurerId: existing.insurerId,
      clientId: existing.clientId,
      partnerId: existing.partnerId,
      singleProvisional: existing.singleProvisional,
      contactName: existing.contactName ?? '',
      contactPhone: existing.contactPhone ?? '',
      contactEmail: existing.contactEmail ?? '',
      originCountryId: existing.originCountryId,
      originStateName: existing.originStateName ?? '',
      originCityName: existing.originCityName ?? '',
      originPortId: existing.originPortId,
      departureForecast: existing.departureForecast?.slice(0, 10) ?? '',
      destinationCountryId: existing.destinationCountryId,
      destinationStateName: existing.destinationStateName ?? '',
      destinationCityName: existing.destinationCityName ?? '',
      destinationPortId: existing.destinationPortId,
      commodityDescription: existing.commodityDescription ?? '',
      notes: existing.notes ?? '',
      internalNotes: existing.internalNotes ?? '',
      cargoCondition: existing.cargoCondition,
      ncm: existing.ncm ?? '',
      brand: existing.brand ?? '',
      weightKg: formatMoney(existing.weightKg),
      invoiceNumber: existing.invoiceNumber ?? '',
      commodityTypeId: existing.commodityTypeId,
      coverageId: existing.coverageId,
      packagingId: existing.packagingId,
      incoterm: existing.incoterm,
      currencyId: existing.currencyId,
      overPercent: formatMoney(existing.overPercent),
      reference: existing.reference ?? '',
      billingVia: existing.billingVia,
      budgetMode: existing.budgetMode,
      declaredValue: existing.declaredValue,
      clientDiscount: formatMoney(existing.clientDiscount),
      insurerDiscount: formatMoney(existing.insurerDiscount),
      expensePercent: formatMoney(existing.expensePercent),
      profitPercent: formatMoney(existing.profitPercent),
      standardDiscount: formatMoney(existing.standardDiscount),
      letterAdditionalPercent: formatMoney(existing.letterAdditionalPercent),
      vesselAdditionalPercent: formatMoney(existing.vesselAdditionalPercent),
      irbValue: formatMoney(existing.irbValue),
      irbCurrencyId: existing.irbCurrencyId,
      salespersonId: existing.salespersonId,
      partnerPercent: formatMoney(existing.partnerPercent),
      brokerPercent: formatMoney(existing.brokerPercent),
      salespersonPercent: formatMoney(existing.salespersonPercent),
      warStrike: existing.warStrike,
      machineryStoppage: existing.machineryStoppage,
      expensesCovered: existing.expensesCovered,
      expectedProfitCovered: existing.expectedProfitCovered,
      minimumPremiumApplied: existing.minimumPremiumApplied,
      transshipment: existing.transshipment,
      creditLetter: existing.creditLetter,
      taxImportDuty: existing.taxImportDuty,
      taxIpi: existing.taxIpi,
      taxIcms: existing.taxIcms,
      taxPis: existing.taxPis,
      taxCofins: existing.taxCofins,
      cost: formatMoney(line('COST')?.amount ?? 0),
      freight: formatMoney(line('FREIGHT')?.amount ?? 0),
      taxes: formatMoney(line('TAXES')?.amount ?? 0),
      cifValue: formatMoney(line('CIF_VALUE')?.amount ?? 0),
      clientBaseRate: formatRate(cost?.baseRateClient ?? 0),
      clientExtraRate: formatRate(cost?.extraRateClient ?? 0),
      clientWarRate: formatRate(cost?.warRateClient ?? 0),
      insurerBaseRate: formatRate(cost?.baseRateInsurer ?? 0),
      insurerExtraRate: formatRate(cost?.extraRateInsurer ?? 0),
      insurerWarRate: formatRate(cost?.warRateInsurer ?? 0),
    });
  }, [existing]);

  const { result, calculating } = useQuoteCalculation(values);

  const { data: currencies } = useQuery({
    queryKey: ['catalog-options', 'currencies'],
    queryFn: async () => {
      const { data } = await api.get('/catalog/currencies/options');
      return data as Array<{ id: string; label: string; code: string | null }>;
    },
  });

  const currencyCode =
    currencies?.find((c) => c.id === values.currencyId)?.code ??
    currencies?.find((c) => c.id === values.currencyId)?.label ??
    '';

  const save = useMutation({
    mutationFn: () => {
      const payload = toPayload(values);
      return isEditing ? api.patch(`/quotes/${id}`, payload) : api.post('/quotes', payload);
    },
    onSuccess: async ({ data }) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });

      if (!isEditing && sigraDraft) {
        try {
          await api.post(`/quotes/${data.id}/references`, {
            source: 'SIGRA',
            value: sigraDraft.sigraId,
          });
        } catch (error) {
          // A cotação já foi criada — só avisa, não bloqueia a navegação.
          toast.error(`Cotação criada, mas não foi possível vincular o processo SIGRA: ${errorMessage(error)}`);
        }
      }

      toast.success(
        isEditing ? 'Cotação atualizada.' : `Cotação ${data.number} criada.`,
      );
      navigate(`/quotes/${data.id}`);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  function validate() {
    const found: Record<string, string> = {};
    if (!values.clientId) found.clientId = 'Selecione o cliente.';
    if (!values.currencyId) found.currencyId = 'Selecione a moeda.';
    setErrors(found);

    if (Object.keys(found).length) {
      // Todos os obrigatórios estão nas duas primeiras etapas.
      setStep(found.clientId ? 0 : 3);
      toast.error('Há campos obrigatórios não preenchidos.');
      return false;
    }
    return true;
  }

  if (isEditing && isLoading) {
    return (
      <Page title="Cotação">
        <Loading />
      </Page>
    );
  }

  if (isEditing && isError) {
    return (
      <Page title="Cotação">
        <LoadError message={errorMessage(error)} />
      </Page>
    );
  }

  const StepComponent = [
    StepIdentification,
    StepRoute,
    StepCargo,
    StepFinancial,
    StepRates,
  ][step];

  const steps = isEditing ? [...STEPS, COMMUNICATION_STEP] : STEPS;
  const isCommunicationStep = steps[step]?.key === 'communication';

  return (
    <Page
      title={
        isEditing
          ? `Cotação ${existing?.number}`
          : `Nova cotação — ${QuoteKind[values.kind]}`
      }
      description={
        isEditing
          ? undefined
          : 'Preencha as etapas na ordem que preferir; o cálculo atualiza sozinho.'
      }
      actions={
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => navigate('/quotes')}>
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <Button
            loading={save.isPending}
            onClick={() => validate() && save.mutate()}
          >
            <Save className="h-4 w-4" />
            {isEditing ? 'Salvar' : 'Criar cotação'}
          </Button>
        </div>
      }
    >
      <div className={cn('grid gap-6', !isCommunicationStep && 'lg:grid-cols-[1fr_300px]')}>
        <div className="min-w-0">
          {/* Etapas */}
          <nav className="mb-5 flex flex-wrap gap-1 border-b border-border">
            {steps.map((s, index) => {
              const active = index === step;
              const done = index < step;
              return (
                <button
                  key={s.key}
                  onClick={() => setStep(index)}
                  className={cn(
                    'relative flex items-center gap-1.5 px-3.5 py-2.5 text-[14px] font-medium transition-colors',
                    active
                      ? 'text-navy'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <span
                    className={cn(
                      'grid h-5 w-5 place-items-center rounded-full text-[11px]',
                      active
                        ? 'bg-navy text-white'
                        : done
                          ? 'bg-success/15 text-success'
                          : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {done ? <Check className="h-3 w-3" strokeWidth={3} /> : index + 1}
                  </span>
                  {s.label}
                  {active && (
                    <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-t bg-navy" />
                  )}
                </button>
              );
            })}
          </nav>

          <div className="animate-fade-in">
            {isCommunicationStep ? (
              <CommunicationPanel
                quoteId={id!}
                defaultTo={existing?.contactEmail ? [existing.contactEmail] : undefined}
                defaultSubject={
                  existing
                    ? `Processo Nº ${existing.number} — ${existing.client?.tradeName ?? existing.client?.legalName ?? ''}`
                    : undefined
                }
              />
            ) : (
              <StepComponent
                values={values}
                set={set}
                errors={errors}
                result={result}
                initialLabels={{
                  client: existing?.client?.tradeName ?? existing?.client?.legalName ?? null,
                  partner: existing?.partner?.tradeName ?? existing?.partner?.legalName ?? null,
                }}
                isEditing={isEditing}
                sigraDraft={sigraDraft}
                onSigraLinked={setSigraDraft}
              />
            )}
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
            <Button
              variant="outline"
              disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              Anterior
            </Button>
            {!isCommunicationStep &&
              (step < STEPS.length - 1 ? (
                <Button variant="outline" onClick={() => setStep((s) => s + 1)}>
                  Próxima etapa
                </Button>
              ) : (
                <Button loading={save.isPending} onClick={() => validate() && save.mutate()}>
                  <Save className="h-4 w-4" />
                  {isEditing ? 'Salvar alterações' : 'Criar cotação'}
                </Button>
              ))}
          </div>
        </div>

        {!isCommunicationStep && (
          <QuoteSummary result={result} calculating={calculating} currencyCode={currencyCode} />
        )}
      </div>
    </Page>
  );
}
