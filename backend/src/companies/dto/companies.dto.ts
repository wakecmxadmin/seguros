import { CompanyRoleType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray, IsBoolean, IsEmail, IsEnum, IsInt, IsOptional, IsString, Min, MinLength,
} from 'class-validator';
import { EmptyToUndefined } from '../../common/transforms';

export class CreateCompanyDto {
  @IsString() @MinLength(2, { message: 'Informe a razão social.' })
  legalName: string;

  @IsOptional() @IsString()
  tradeName?: string;

  @IsOptional() @IsString()
  document?: string;

  @IsOptional() @IsString()
  stateReg?: string;

  @IsOptional() @EmptyToUndefined() @IsEmail({}, { message: 'E-mail inválido.' })
  email?: string;

  @IsOptional() @IsString()
  phone?: string;

  @IsOptional() @IsString()
  mobile?: string;

  @IsOptional() @IsString()
  zipCode?: string;

  @IsOptional() @IsString()
  address?: string;

  @IsOptional() @IsString()
  number?: string;

  @IsOptional() @IsString()
  district?: string;

  @IsOptional() @IsString()
  cityName?: string;

  @IsOptional() @IsString()
  stateName?: string;

  @IsOptional() @IsString()
  countryName?: string;

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional() @IsBoolean()
  active?: boolean;

  @IsArray() @IsEnum(CompanyRoleType, { each: true })
  roles: CompanyRoleType[];
}

export class UpdateCompanyDto extends CreateCompanyDto {
  @IsOptional() @IsString() @MinLength(2)
  declare legalName: string;

  @IsOptional() @IsArray() @IsEnum(CompanyRoleType, { each: true })
  declare roles: CompanyRoleType[];
}

export class ListCompaniesDto {
  @IsOptional() @IsString()
  search?: string;

  @IsOptional() @IsEnum(CompanyRoleType)
  role?: CompanyRoleType;

  @IsOptional() @IsString()
  active?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  perPage?: number;
}
