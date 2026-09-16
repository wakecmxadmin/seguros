import {
  BillingVia, BudgetMode, CargoCondition, DeclaredValue, Incoterm, Modal,
  QuoteKind, QuotePosition, QuoteStatus,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min, MinLength,
} from 'class-validator';
import { EmptyToUndefined } from '../../common/transforms';

/** Campos que alimentam o motor de cálculo. */
export class CalculateQuoteDto {
  @IsEnum(QuoteKind)
  kind: QuoteKind;

  @IsEnum(Modal)
  modal: Modal;

  @IsOptional() @IsUUID()
  policyId?: string;

  @IsOptional() @IsUUID()
  coverageId?: string;

  @IsOptional() @IsUUID()
  commodityTypeId?: string;

  @IsUUID('4', { message: 'Selecione a moeda.' })
  currencyId: string;

  @IsOptional() @IsDateString()
  issueDate?: string;

  // --- Verbas -------------------------------------------------------------
  @IsOptional() @IsNumber() @Min(0)
  cost?: number;

  @IsOptional() @IsNumber() @Min(0)
  freight?: number;

  @IsOptional() @IsNumber() @Min(0)
  taxes?: number;

  @IsOptional() @IsNumber() @Min(0)
  cifValue?: number;

  @IsOptional() @IsNumber() @Min(0)
  expensePercent?: number;

  @IsOptional() @IsNumber() @Min(0)
  profitPercent?: number;

  // --- Taxas (sobrescrevem as da apólice/cobertura) -----------------------
  @IsOptional() @IsNumber() @Min(0)
  clientBaseRate?: number;

  @IsOptional() @IsNumber() @Min(0)
  clientExtraRate?: number;

  @IsOptional() @IsNumber() @Min(0)
  clientWarRate?: number;

  @IsOptional() @IsNumber() @Min(0)
  insurerBaseRate?: number;

  @IsOptional() @IsNumber() @Min(0)
  insurerExtraRate?: number;

  @IsOptional() @IsNumber() @Min(0)
  insurerWarRate?: number;

  @IsOptional() @IsNumber() @Min(0)
  minimumPremium?: number;

  @IsOptional() @IsNumber() @Min(0)
  vesselAdditionalPercent?: number;

  @IsOptional() @IsNumber() @Min(0)
  exchangeRate?: number;

  /** Ver novas_tarefas.md item 1 — 20% ou 25%, a confirmar. */
  @IsOptional() @IsNumber() @Min(0)
  insurerSurchargePercent?: number;

  // --- Coberturas acessórias ---------------------------------------------
  @IsOptional() @IsBoolean() warStrike?: boolean;
  @IsOptional() @IsBoolean() machineryStoppage?: boolean;
  @IsOptional() @IsBoolean() expensesCovered?: boolean;
  @IsOptional() @IsBoolean() expectedProfitCovered?: boolean;
  @IsOptional() @IsBoolean() minimumPremiumApplied?: boolean;
  @IsOptional() @IsBoolean() transshipment?: boolean;
  @IsOptional() @IsBoolean() creditLetter?: boolean;

  // --- Comissões ----------------------------------------------------------
  @IsOptional() @IsNumber() @Min(0) partnerPercent?: number;
  @IsOptional() @IsNumber() @Min(0) brokerPercent?: number;
  @IsOptional() @IsNumber() @Min(0) salespersonPercent?: number;
}

/** Cálculo + dados cadastrais do processo. */
export class SaveQuoteDto extends CalculateQuoteDto {
  @IsUUID('4', { message: 'Selecione o cliente.' })
  clientId: string;

  @IsOptional() @IsUUID()
  partnerId?: string;

  @IsOptional() @IsUUID()
  insurerId?: string;

  @IsOptional() @IsDateString()
  pendingLimitDate?: string;

  @IsOptional() @IsBoolean()
  singleProvisional?: boolean;

  @IsOptional() @EmptyToUndefined() @IsString()
  contactName?: string;

  @IsOptional() @EmptyToUndefined() @IsString()
  contactPhone?: string;

  @IsOptional() @EmptyToUndefined() @IsString()
  contactEmail?: string;

  // --- Origem e destino ---------------------------------------------------
  @IsOptional() @IsUUID() originCountryId?: string;
  @IsOptional() @EmptyToUndefined() @IsString() originStateName?: string;
  @IsOptional() @EmptyToUndefined() @IsString() originCityName?: string;
  @IsOptional() @IsUUID() originPortId?: string;
  @IsOptional() @IsDateString() departureForecast?: string;

  @IsOptional() @IsUUID() destinationCountryId?: string;
  @IsOptional() @EmptyToUndefined() @IsString() destinationStateName?: string;
  @IsOptional() @EmptyToUndefined() @IsString() destinationCityName?: string;
  @IsOptional() @IsUUID() destinationPortId?: string;

  // --- Produto ------------------------------------------------------------
  @IsOptional() @EmptyToUndefined() @IsString()
  commodityDescription?: string;

  @IsOptional() @EmptyToUndefined() @IsString() notes?: string;
  @IsOptional() @EmptyToUndefined() @IsString() internalNotes?: string;
  @IsOptional() @IsEnum(CargoCondition) cargoCondition?: CargoCondition;
  @IsOptional() @EmptyToUndefined() @IsString() ncm?: string;
  @IsOptional() @EmptyToUndefined() @IsString() brand?: string;
  @IsOptional() @IsNumber() @Min(0) weightKg?: number;
  @IsOptional() @EmptyToUndefined() @IsString() invoiceNumber?: string;
  @IsOptional() @IsUUID() packagingId?: string;

  // --- Financeiro ---------------------------------------------------------
  @IsOptional() @IsEnum(Incoterm) incoterm?: Incoterm;
  @IsOptional() @IsNumber() @Min(0) overPercent?: number;
  @IsOptional() @EmptyToUndefined() @IsString() reference?: string;
  @IsOptional() @IsEnum(BillingVia) billingVia?: BillingVia;
  @IsOptional() @IsEnum(BudgetMode) budgetMode?: BudgetMode;
  @IsOptional() @IsEnum(DeclaredValue) declaredValue?: DeclaredValue;
  @IsOptional() @IsNumber() @Min(0) clientDiscount?: number;
  @IsOptional() @IsNumber() @Min(0) insurerDiscount?: number;
  @IsOptional() @IsNumber() @Min(0) standardDiscount?: number;
  @IsOptional() @IsNumber() @Min(0) letterAdditionalPercent?: number;
  @IsOptional() @IsNumber() @Min(0) irbValue?: number;
  @IsOptional() @IsUUID() irbCurrencyId?: string;

  @IsOptional() @IsUUID() salespersonId?: string;

  // --- Impostos -----------------------------------------------------------
  @IsOptional() @IsBoolean() taxImportDuty?: boolean;
  @IsOptional() @IsBoolean() taxIpi?: boolean;
  @IsOptional() @IsBoolean() taxIcms?: boolean;
  @IsOptional() @IsBoolean() taxPis?: boolean;
  @IsOptional() @IsBoolean() taxCofins?: boolean;
}

/**
 * O preview recebe o mesmo payload da tela, mas sem exigir os campos que só
 * importam ao salvar — assim o recálculo funciona antes de escolher o cliente.
 */
export class PreviewQuoteDto extends SaveQuoteDto {
  @IsOptional() @IsUUID()
  declare clientId: string;

  @IsOptional() @IsUUID()
  declare currencyId: string;
}

export class ListQuotesDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsEnum(QuoteKind) kind?: QuoteKind;
  @IsOptional() @IsEnum(QuoteStatus) status?: QuoteStatus;
  @IsOptional() @IsEnum(QuotePosition) position?: QuotePosition;
  @IsOptional() @IsUUID() clientId?: string;
  @IsOptional() @IsUUID() partnerId?: string;
  @IsOptional() @IsUUID() insurerId?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) perPage?: number;
}

export class DecideQuoteDto {
  @IsBoolean()
  approved: boolean;

  @IsOptional() @EmptyToUndefined() @IsString()
  reason?: string;
}

export class CancelQuoteDto {
  @IsString() @MinLength(3, { message: 'Informe o motivo do cancelamento.' })
  reason: string;
}
