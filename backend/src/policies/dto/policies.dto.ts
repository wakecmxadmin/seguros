import { QuoteKind } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min, MinLength,
} from 'class-validator';

export class CreatePolicyDto {
  @IsString() @MinLength(1, { message: 'Informe o número da apólice.' })
  number: string;

  @IsOptional() @IsString()
  description?: string;

  @IsEnum(QuoteKind, { message: 'Informe se a apólice é de importação ou exportação.' })
  kind: QuoteKind;

  @IsUUID('4', { message: 'Selecione a seguradora.' })
  insurerId: string;

  @IsOptional() @IsNumber() @Min(0)
  insuredLimit?: number;

  @IsOptional() @IsString()
  brokerCode?: string;

  /** Taxas que o legado escondia no texto da descrição. */
  @IsOptional() @IsNumber() @Min(0)
  baseRateClient?: number;

  @IsOptional() @IsNumber() @Min(0)
  baseRateInsurer?: number;

  /** Piso de prêmio — não existia em tela no legado, mas o cálculo o aplicava. */
  @IsOptional() @IsNumber() @Min(0)
  minimumPremium?: number;

  @IsOptional() @IsUUID()
  minimumPremiumCurrencyId?: string;

  @IsOptional() @IsDateString()
  validFrom?: string;

  @IsOptional() @IsDateString()
  validTo?: string;

  @IsOptional() @IsBoolean()
  active?: boolean;
}

export class UpdatePolicyDto extends CreatePolicyDto {
  @IsOptional() @IsString() @MinLength(1)
  declare number: string;

  @IsOptional() @IsEnum(QuoteKind)
  declare kind: QuoteKind;

  @IsOptional() @IsUUID()
  declare insurerId: string;
}

export class ListPoliciesDto {
  @IsOptional() @IsString()
  search?: string;

  @IsOptional() @IsEnum(QuoteKind)
  kind?: QuoteKind;

  @IsOptional() @IsUUID()
  insurerId?: string;

  @IsOptional() @IsString()
  active?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  perPage?: number;
}

export class CreateCoverageDto {
  @IsString() @MinLength(2, { message: 'Informe o nome da cobertura.' })
  name: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsBoolean()
  accessory?: boolean;

  @IsOptional() @IsNumber() @Min(0)
  seaRateInsurer?: number;

  @IsOptional() @IsNumber() @Min(0)
  seaRateClient?: number;

  @IsOptional() @IsNumber() @Min(0)
  airRateInsurer?: number;

  @IsOptional() @IsNumber() @Min(0)
  airRateClient?: number;

  @IsOptional() @IsBoolean()
  active?: boolean;
}

export class UpdateCoverageDto extends CreateCoverageDto {
  @IsOptional() @IsString() @MinLength(2)
  declare name: string;
}
