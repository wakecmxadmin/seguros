import { ArrayMaxSize, IsArray, IsEmail, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class SendMessageDto {
  @IsArray()
  @ArrayMaxSize(20)
  @IsEmail({}, { each: true, message: 'Informe endereços de e-mail válidos em Para.' })
  to: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsEmail({}, { each: true, message: 'Informe endereços de e-mail válidos em Cc.' })
  cc?: string[];

  @IsString() @MinLength(1, { message: 'Informe o assunto.' })
  subject: string;

  @IsString() @MinLength(1, { message: 'O corpo do e-mail não pode ficar vazio.' })
  bodyHtml: string;

  @IsString()
  bodyText: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  attachmentIds?: string[];
}
