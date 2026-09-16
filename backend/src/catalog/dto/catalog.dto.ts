import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ListCatalogDto {
  @IsOptional() @IsString()
  search?: string;

  /** 'true' | 'false' — omitido traz ativos e inativos. */
  @IsOptional() @IsString()
  active?: string;

  /** País (para estados/portos) ou estado (para cidades). */
  @IsOptional() @IsString()
  parentId?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  perPage?: number;
}
