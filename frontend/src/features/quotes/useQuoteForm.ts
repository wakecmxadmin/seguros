import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { parseNumber } from '@/lib/format';

export interface QuoteFormValues {
  kind: 'IMPORT' | 'EXPORT';
  modal: 'AIR' | 'SEA' | 'ROAD' | 'RAIL';

  issueDate: string;
  pendingLimitDate: string;
  policyId: string | null;
  insurerId: string | null;
  clientId: string | null;
  partnerId: string | null;
  singleProvisional: boolean;

  contactName: string;
  contactPhone: string;
  contactEmail: string;

  originCountryId: string | null;
  originStateName: string;
  originCityName: string;
  originPortId: string | null;
  departureForecast: string;

  destinationCountryId: string | null;
  destinationStateName: string;
  destinationCityName: string;
  destinationPortId: string | null;

  commodityDescription: string;
  notes: string;
  internalNotes: string;
  cargoCondition: 'NEW' | 'USED';
  ncm: string;
  brand: string;
  weightKg: string;
  invoiceNumber: string;
  commodityTypeId: string | null;
  coverageId: string | null;
  packagingId: string | null;

  incoterm: string;
  currencyId: string | null;
  overPercent: string;
  reference: string;
  billingVia: 'BROKER' | 'PARTNER';
  budgetMode: 'RATES' | 'VALUES';
  declaredValue: string;

  clientDiscount: string;
  insurerDiscount: string;
  expensePercent: string;
  profitPercent: string;

  standardDiscount: string;
  letterAdditionalPercent: string;
  vesselAdditionalPercent: string;
  irbValue: string;
  irbCurrencyId: string | null;

  salespersonId: string | null;
  partnerPercent: string;
  brokerPercent: string;
  salespersonPercent: string;

  warStrike: boolean;
  machineryStoppage: boolean;
  expensesCovered: boolean;
  expectedProfitCovered: boolean;
  minimumPremiumApplied: boolean;
  transshipment: boolean;
  creditLetter: boolean;

  taxImportDuty: boolean;
  taxIpi: boolean;
  taxIcms: boolean;
  taxPis: boolean;
  taxCofins: boolean;

  // Verbas e taxas
  cost: string;
  freight: string;
  taxes: string;
  cifValue: string;
  clientBaseRate: string;
  clientExtraRate: string;
  clientWarRate: string;
  insurerBaseRate: string;
  insurerExtraRate: string;
  insurerWarRate: string;
  minimumPremium: string;
  insurerSurchargePercent: string;
}

export interface CalculationLine {
  item: string;
  amount: number;
  client: { base: number; extra: number; war: number; total: number; premium: number };
  insurer: { base: number; extra: number; war: number; total: number; premium: number };
}

export interface CalculationResult {
  lines: CalculationLine[];
  insuredAmount: number;
  premiumClientRaw: number;
  premiumClient: number;
  premiumInsurer: number;
  minimumPremiumUsed: boolean;
  grossMargin: number;
  marginPercent: number;
  insurerPayable: number;
  insurerSurcharge: number;
  commissions: { partner: number; broker: number; salesperson: number; total: number };
  exchangeRate: number;
  insuredAmountBrl: number;
  premiumClientBrl: number;
  premiumInsurerBrl: number;
}

export function emptyQuote(kind: 'IMPORT' | 'EXPORT'): QuoteFormValues {
  return {
    kind,
    modal: 'SEA',
    issueDate: new Date().toISOString().slice(0, 10),
    pendingLimitDate: '',
    policyId: null,
    insurerId: null,
    clientId: null,
    partnerId: null,
    singleProvisional: false,
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    originCountryId: null,
    originStateName: '',
    originCityName: '',
    originPortId: null,
    departureForecast: '',
    destinationCountryId: null,
    destinationStateName: '',
    destinationCityName: '',
    destinationPortId: null,
    commodityDescription: '',
    notes: '',
    internalNotes: '',
    cargoCondition: 'NEW',
    ncm: '',
    brand: '',
    weightKg: '0,00',
    invoiceNumber: '',
    commodityTypeId: null,
    coverageId: null,
    packagingId: null,
    incoterm: 'CFR',
    currencyId: null,
    overPercent: '0,00',
    reference: '',
    billingVia: 'BROKER',
    budgetMode: 'RATES',
    declaredValue: 'DECLARED',
    clientDiscount: '0,00',
    insurerDiscount: '0,00',
    // Defaults do legado.
    expensePercent: '10,00',
    profitPercent: '10,00',
    standardDiscount: '0,00',
    letterAdditionalPercent: '10,00',
    vesselAdditionalPercent: '0,00',
    irbValue: '0,00',
    irbCurrencyId: null,
    salespersonId: null,
    partnerPercent: '30,00',
    brokerPercent: '0,00',
    salespersonPercent: '0,00',
    warStrike: kind === 'EXPORT',
    machineryStoppage: false,
    expensesCovered: false,
    expectedProfitCovered: false,
    minimumPremiumApplied: false,
    transshipment: false,
    creditLetter: false,
    taxImportDuty: false,
    taxIpi: false,
    taxIcms: false,
    taxPis: false,
    taxCofins: false,
    cost: '0,00',
    freight: '0,00',
    taxes: '0,00',
    cifValue: '0,00',
    clientBaseRate: '0,00000',
    clientExtraRate: '0,00000',
    clientWarRate: '0,00000',
    insurerBaseRate: '0,00000',
    insurerExtraRate: '0,00000',
    insurerWarRate: '0,00000',
    minimumPremium: '0,00',
    insurerSurchargePercent: '0,00',
  };
}

/** Converte o formulário no payload que o backend espera. */
export function toPayload(values: QuoteFormValues) {
  const n = (v: string) => parseNumber(v || '0');

  return {
    kind: values.kind,
    modal: values.modal,
    issueDate: values.issueDate || undefined,
    pendingLimitDate: values.pendingLimitDate || undefined,
    policyId: values.policyId ?? undefined,
    insurerId: values.insurerId ?? undefined,
    clientId: values.clientId ?? undefined,
    partnerId: values.partnerId ?? undefined,
    singleProvisional: values.singleProvisional,
    contactName: values.contactName || undefined,
    contactPhone: values.contactPhone || undefined,
    contactEmail: values.contactEmail || undefined,

    originCountryId: values.originCountryId ?? undefined,
    originStateName: values.originStateName || undefined,
    originCityName: values.originCityName || undefined,
    originPortId: values.originPortId ?? undefined,
    departureForecast: values.departureForecast || undefined,

    destinationCountryId: values.destinationCountryId ?? undefined,
    destinationStateName: values.destinationStateName || undefined,
    destinationCityName: values.destinationCityName || undefined,
    destinationPortId: values.destinationPortId ?? undefined,

    commodityDescription: values.commodityDescription || undefined,
    notes: values.notes || undefined,
    internalNotes: values.internalNotes || undefined,
    cargoCondition: values.cargoCondition,
    ncm: values.ncm || undefined,
    brand: values.brand || undefined,
    weightKg: n(values.weightKg),
    invoiceNumber: values.invoiceNumber || undefined,
    commodityTypeId: values.commodityTypeId ?? undefined,
    coverageId: values.coverageId ?? undefined,
    packagingId: values.packagingId ?? undefined,

    incoterm: values.incoterm,
    currencyId: values.currencyId ?? undefined,
    overPercent: n(values.overPercent),
    reference: values.reference || undefined,
    billingVia: values.billingVia,
    budgetMode: values.budgetMode,
    declaredValue: values.declaredValue,

    clientDiscount: n(values.clientDiscount),
    insurerDiscount: n(values.insurerDiscount),
    expensePercent: n(values.expensePercent),
    profitPercent: n(values.profitPercent),
    standardDiscount: n(values.standardDiscount),
    letterAdditionalPercent: n(values.letterAdditionalPercent),
    vesselAdditionalPercent: n(values.vesselAdditionalPercent),
    irbValue: n(values.irbValue),
    irbCurrencyId: values.irbCurrencyId ?? undefined,

    salespersonId: values.salespersonId ?? undefined,
    partnerPercent: n(values.partnerPercent),
    brokerPercent: n(values.brokerPercent),
    salespersonPercent: n(values.salespersonPercent),

    warStrike: values.warStrike,
    machineryStoppage: values.machineryStoppage,
    expensesCovered: values.expensesCovered,
    expectedProfitCovered: values.expectedProfitCovered,
    minimumPremiumApplied: values.minimumPremiumApplied,
    transshipment: values.transshipment,
    creditLetter: values.creditLetter,

    taxImportDuty: values.taxImportDuty,
    taxIpi: values.taxIpi,
    taxIcms: values.taxIcms,
    taxPis: values.taxPis,
    taxCofins: values.taxCofins,

    cost: n(values.cost),
    freight: n(values.freight),
    taxes: n(values.taxes),
    cifValue: n(values.cifValue),
    clientBaseRate: n(values.clientBaseRate),
    clientExtraRate: n(values.clientExtraRate),
    clientWarRate: n(values.clientWarRate),
    insurerBaseRate: n(values.insurerBaseRate),
    insurerExtraRate: n(values.insurerExtraRate),
    insurerWarRate: n(values.insurerWarRate),
    minimumPremium: n(values.minimumPremium),
    insurerSurchargePercent: n(values.insurerSurchargePercent),
  };
}

/**
 * Recálculo reativo: o legado só recalculava ao clicar "Calcular", então era
 * comum salvar um processo com totais desatualizados.
 */
export function useQuoteCalculation(values: QuoteFormValues) {
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [calculating, setCalculating] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  // Só os campos que afetam o cálculo entram na dependência.
  const signature = useMemo(
    () =>
      JSON.stringify([
        values.kind, values.modal, values.currencyId, values.policyId, values.coverageId,
        values.commodityTypeId, values.issueDate,
        values.cost, values.freight, values.taxes, values.cifValue,
        values.expensePercent, values.profitPercent,
        values.clientBaseRate, values.clientExtraRate, values.clientWarRate,
        values.insurerBaseRate, values.insurerExtraRate, values.insurerWarRate,
        values.minimumPremium, values.vesselAdditionalPercent, values.insurerSurchargePercent,
        values.warStrike, values.expensesCovered, values.expectedProfitCovered,
        values.minimumPremiumApplied,
        values.partnerPercent, values.brokerPercent, values.salespersonPercent,
      ]),
    [values],
  );

  const run = useCallback(async () => {
    if (!values.currencyId) {
      setResult(null);
      return;
    }
    setCalculating(true);
    try {
      const { data } = await api.post('/quotes/preview', toPayload(values));
      setResult(data.result as CalculationResult);
    } catch {
      // Erro de cálculo não deve travar a digitação; o resumo apenas não atualiza.
    } finally {
      setCalculating(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(run, 400);
    return () => clearTimeout(timer.current);
  }, [run]);

  return { result, calculating };
}
