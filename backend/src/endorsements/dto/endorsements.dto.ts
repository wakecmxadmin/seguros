import { EndorsementPosition, EndorsementType, QuoteKind } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min, MinLength,
} from 'class-validator';
import { EmptyToUndefined } from '../../common/transforms';

export class IssueProvisionalDto {
  @IsUUID('4', { message: 'Informe a cotação de origem.' })
  quoteId: string;

  @IsOptional() @IsDateString()
  issuedAt?: string;

  @IsOptional() @IsDateString()
  berthingDate?: string;

  @IsOptional() @EmptyToUndefined() @IsString()
  blNumber?: string;

  @IsOptional() @EmptyToUndefined() @IsString()
  containerNumber?: string;

  @IsOptional() @IsUUID()
  vesselId?: string;

  @IsOptional() @EmptyToUndefined() @IsString()
  notes?: string;
}

export class IssueFinalDto {
  @IsUUID('4', { message: 'Selecione a provisória de origem.' })
  provisionalId: string;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Informe a importância segurada.' })
  @Min(0.01, { message: 'A importância segurada deve ser maior que zero.' })
  insuredAmount: number;

  /** Obrigatória se a provisória ainda não tiver data de atracação. */
  @IsOptional() @IsDateString()
  berthingDate?: string;

  @IsOptional() @EmptyToUndefined() @IsString()
  blNumber?: string;

  @IsOptional() @EmptyToUndefined() @IsString()
  containerNumber?: string;

  @IsOptional() @IsUUID()
  vesselId?: string;

  @IsOptional() @EmptyToUndefined() @IsString()
  notes?: string;
}

export class ChangePositionDto {
  @IsEnum(EndorsementPosition)
  position: EndorsementPosition;

  @IsOptional() @EmptyToUndefined() @IsString() @MinLength(3)
  reason?: string;
}

export class ListEndorsementsDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsEnum(EndorsementType) type?: EndorsementType;
  @IsOptional() @IsEnum(EndorsementPosition) position?: EndorsementPosition;
  @IsOptional() @IsEnum(QuoteKind) kind?: QuoteKind;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  /** 'true' traz apenas provisórias com saldo disponível. */
  @IsOptional() @IsString() withBalance?: string;
  /** 'true' traz só definitivas com prorrogação ativa ("Definitivas em Prorrogação"). */
  @IsOptional() @IsString() extended?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) perPage?: number;
}

/**
 * Seleção da "Impressão/Arquivo de Provisórias e Definitivas" do legado:
 * faixa de averbação + seguradora (+ período, que o legado não tinha).
 */
export class EndorsementSelectionDto {
  @IsEnum(EndorsementType, { message: 'Escolha provisórias ou definitivas.' })
  type: EndorsementType;

  @IsOptional() @EmptyToUndefined() @IsUUID('4') insurerId?: string;
  @IsOptional() @EmptyToUndefined() @IsEnum(QuoteKind) kind?: QuoteKind;
  @IsOptional() @EmptyToUndefined() @Type(() => Number) @IsInt() @Min(0) numberFrom?: number;
  @IsOptional() @EmptyToUndefined() @Type(() => Number) @IsInt() @Min(0) numberTo?: number;
  @IsOptional() @EmptyToUndefined() @IsDateString() from?: string;
  @IsOptional() @EmptyToUndefined() @IsDateString() to?: string;
}

export class IssueExtensionDto {
  @IsOptional() @EmptyToUndefined() @IsDateString() issuedAt?: string;
  @IsOptional() @EmptyToUndefined() @IsDateString() coverageUntil?: string;
  /** Sobrescreve o percentual dos Parâmetros nesta prorrogação. */
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0.01, { message: 'Percentual inválido.' })
  percent?: number;
  @IsOptional() @EmptyToUndefined() @IsString() notes?: string;
}

export class CancelExtensionDto {
  @IsString() @MinLength(3, { message: 'Informe o motivo do cancelamento.' })
  reason: string;
}
