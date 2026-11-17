import { QuoteKind } from '@prisma/client';
import { IsDateString, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { EmptyToUndefined } from '../../common/transforms';

export const RANKING_DIMENSIONS = ['client', 'partner', 'policy', 'state'] as const;
export type RankingDimension = (typeof RANKING_DIMENSIONS)[number];

export class ReportFiltersDto {
  @IsOptional() @EmptyToUndefined() @IsDateString({}, { message: 'Data inicial inválida.' })
  from?: string;

  @IsOptional() @EmptyToUndefined() @IsDateString({}, { message: 'Data final inválida.' })
  to?: string;

  /**
   * Importação, exportação ou `EXTENDED` — o tipo "Prorrogada" (`cdTipo=2`) da
   * Planilha Produção do legado, que lista só as prorrogações do período.
   */
  @IsOptional() @EmptyToUndefined() @IsIn([...Object.values(QuoteKind), 'EXTENDED'], { message: 'Tipo inválido.' })
  kind?: QuoteKind | 'EXTENDED';

  @IsOptional() @EmptyToUndefined() @IsUUID()
  clientId?: string;

  @IsOptional() @EmptyToUndefined() @IsUUID()
  partnerId?: string;

  @IsOptional() @EmptyToUndefined() @IsUUID()
  insurerId?: string;

  @IsOptional() @EmptyToUndefined() @IsUUID()
  policyId?: string;

  @IsOptional() @EmptyToUndefined() @IsString()
  state?: string;
}

export class RankingParamDto {
  @IsIn(RANKING_DIMENSIONS, { message: 'Ranking inválido.' })
  dimension: RankingDimension;
}
