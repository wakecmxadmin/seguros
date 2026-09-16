import { Type } from 'class-transformer';
import { IsBoolean, IsEmail, IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';
import { EmptyToUndefined } from '../../common/transforms';

export class CreateEmployeeDto {
  @IsString() @MinLength(3, { message: 'Informe o nome do funcionário.' })
  name: string;

  @IsOptional() @EmptyToUndefined() @IsEmail({}, { message: 'E-mail inválido.' })
  email?: string;

  @IsOptional() @IsString()
  department?: string;

  @IsOptional() @IsString()
  jobTitle?: string;

  @IsOptional() @IsBoolean()
  isSalesperson?: boolean;

  @IsOptional() @IsBoolean()
  active?: boolean;

  /** Vínculo com a conta de acesso — inexistente no legado. */
  @IsOptional() @IsUUID()
  userId?: string;
}

export class UpdateEmployeeDto extends CreateEmployeeDto {
  @IsOptional() @IsString() @MinLength(3)
  declare name: string;
}

export class ListEmployeesDto {
  @IsOptional() @IsString()
  search?: string;

  @IsOptional() @IsString()
  active?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  perPage?: number;
}
