import { CashRequestStatus, CommissionBeneficiary, CommissionStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty, IsArray, IsDateString, IsEnum, IsInt, IsNumber, IsOptional,
  IsString, IsUUID, Min,
} from 'class-validator';
import { EmptyToUndefined } from '../../common/transforms';

// --- Numerário -------------------------------------------------------------

export class CreateCashRequestDto {
  @IsUUID('4', { message: 'Selecione a averbação definitiva.' })
  endorsementId: string;

  /** Agravo sobre o valor devido à seguradora — 20 % ou 25 %, a confirmar. */
  @IsOptional() @IsNumber() @Min(0)
  surchargePercent?: number;

  @IsOptional() @IsDateString()
  chargeDate?: string;

  @IsOptional() @EmptyToUndefined() @IsString()
  notes?: string;
}

export class SendCashRequestsDto {
  @IsArray() @ArrayNotEmpty({ message: 'Selecione ao menos um numerário.' })
  @IsUUID('4', { each: true })
  ids: string[];
}

export class SettleCashRequestDto {
  @IsOptional() @IsDateString()
  paymentDate?: string;

  /** Valor efetivamente recebido em reais, quando difere do calculado. */
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  receivedAmountBrl?: number;
}

export class ListCashRequestsDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsEnum(CashRequestStatus) status?: CashRequestStatus;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) perPage?: number;
}

// --- Comissões -------------------------------------------------------------

export class ListCommissionsDto {
  @IsOptional() @IsEnum(CommissionStatus) status?: CommissionStatus;
  @IsOptional() @IsEnum(CommissionBeneficiary) beneficiary?: CommissionBeneficiary;
  @IsOptional() @IsUUID() companyId?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) perPage?: number;
}

export class RequestInvoiceDto {
  @IsArray() @ArrayNotEmpty({ message: 'Selecione ao menos uma comissão.' })
  @IsUUID('4', { each: true })
  ids: string[];
}

export class PayCommissionsDto {
  @IsArray() @ArrayNotEmpty({ message: 'Selecione ao menos uma comissão.' })
  @IsUUID('4', { each: true })
  ids: string[];

  @IsOptional() @IsDateString()
  paymentDate?: string;

  @IsOptional() @EmptyToUndefined() @IsString()
  invoiceNumber?: string;
}
