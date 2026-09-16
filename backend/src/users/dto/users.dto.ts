import { UserStatus, UserType } from '@prisma/client';
import {
  IsArray, IsBoolean, IsEmail, IsEnum, IsInt, IsOptional, IsString,
  IsUUID, Min, MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateUserDto {
  @IsString() @MinLength(3, { message: 'Informe o nome completo.' })
  name: string;

  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email: string;

  @IsOptional() @IsString()
  document?: string;

  @IsEnum(UserType)
  type: UserType;

  @IsOptional() @IsString()
  phone?: string;

  @IsOptional() @IsString()
  jobTitle?: string;

  @IsOptional() @IsString()
  department?: string;

  @IsOptional() @IsString()
  clientId?: string;

  @IsOptional() @IsString()
  partnerId?: string;

  @IsArray() @IsUUID('4', { each: true })
  roleIds: string[];
}

export class UpdateUserDto {
  @IsOptional() @IsString() @MinLength(3)
  name?: string;

  @IsOptional() @IsEmail()
  email?: string;

  @IsOptional() @IsString()
  document?: string;

  @IsOptional() @IsEnum(UserType)
  type?: UserType;

  @IsOptional() @IsString()
  phone?: string;

  @IsOptional() @IsString()
  jobTitle?: string;

  @IsOptional() @IsString()
  department?: string;

  @IsOptional() @IsString()
  clientId?: string;

  @IsOptional() @IsString()
  partnerId?: string;

  @IsOptional() @IsArray() @IsUUID('4', { each: true })
  roleIds?: string[];
}

export class ListUsersDto {
  @IsOptional() @IsString()
  search?: string;

  @IsOptional() @IsEnum(UserType)
  type?: UserType;

  @IsOptional() @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional() @IsUUID()
  roleId?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  perPage?: number;
}

export class ToggleStatusDto {
  @IsBoolean()
  active: boolean;
}
