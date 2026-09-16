import { Modal, QuoteKind } from '@prisma/client';
import {
  IsBoolean, IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min,
} from 'class-validator';
import { EmptyToUndefined } from '../../common/transforms';

export class CreateClientRateDto {
  @IsUUID('4', { message: 'Selecione o cliente.' })
  clientId: string;

  /** Escopos opcionais — quanto mais preenchidos, mais específica a regra. */
  @IsOptional() @IsUUID() policyId?: string;
  @IsOptional() @IsUUID() coverageId?: string;
  @IsOptional() @IsUUID() commodityTypeId?: string;
  @IsOptional() @IsEnum(Modal) modal?: Modal;
  @IsOptional() @IsEnum(QuoteKind) kind?: QuoteKind;

  @IsNumber({ maxDecimalPlaces: 5 }, { message: 'Informe a taxa do cliente.' })
  @Min(0)
  rateClient: number;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 5 }) @Min(0)
  rateInsurer?: number;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  minimumPremium?: number;

  @IsOptional() @IsDateString() validFrom?: string;
  @IsOptional() @IsDateString() validTo?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @EmptyToUndefined() @IsString() notes?: string;
}

export class UpdateClientRateDto extends CreateClientRateDto {
  @IsOptional() @IsUUID()
  declare clientId: string;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 5 }) @Min(0)
  declare rateClient: number;
}
