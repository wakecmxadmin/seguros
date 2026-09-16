import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class ListAuditDto {
  /** Nome do model afetado (User, Role, Quote, Company…). */
  @IsOptional() @IsString()
  entity?: string;

  @IsOptional() @IsString()
  entityId?: string;

  @IsOptional() @IsUUID()
  userId?: string;

  @IsOptional() @IsString()
  action?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  perPage?: number;
}
