import { IsArray, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateRoleDto {
  @IsString() @MinLength(3, { message: 'Informe o nome do papel.' })
  name: string;

  @IsOptional() @IsString()
  description?: string;

  /** Slugs de permissão, no formato `resource:action`. */
  @IsArray() @IsString({ each: true })
  permissions: string[];
}

export class UpdateRoleDto {
  @IsOptional() @IsString() @MinLength(3)
  name?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  permissions?: string[];
}
