import { Type } from 'class-transformer';
import {
  ArrayNotEmpty, IsArray, IsDateString, IsInt, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Min,
} from 'class-validator';

export class ListRatesDto {
  @IsOptional() @IsUUID()
  currencyId?: string;

  @IsOptional() @IsDateString()
  from?: string;

  @IsOptional() @IsDateString()
  to?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  perPage?: number;
}

export class UpsertRateDto {
  @IsDateString({}, { message: 'Informe a data.' })
  date: string;

  @IsUUID('4', { message: 'Selecione a moeda.' })
  currencyId: string;

  @IsNumber({ maxDecimalPlaces: 6 }, { message: 'Informe a cotação.' })
  @IsPositive({ message: 'A cotação deve ser maior que zero.' })
  rate: number;
}

export class ImportPtaxDto {
  @IsDateString({}, { message: 'Informe a data inicial.' })
  from: string;

  @IsDateString({}, { message: 'Informe a data final.' })
  to: string;

  @IsOptional() @IsArray() @ArrayNotEmpty() @IsString({ each: true })
  currencyCodes?: string[];
}
