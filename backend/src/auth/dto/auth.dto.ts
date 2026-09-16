import { IsEmail, IsNotEmpty, IsString, MinLength, Matches } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Informe a senha.' })
  password: string;
}

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @MinLength(10, { message: 'A senha deve ter ao menos 10 caracteres.' })
  @Matches(/[a-z]/, { message: 'A senha deve conter ao menos uma letra minúscula.' })
  @Matches(/[A-Z]/, { message: 'A senha deve conter ao menos uma letra maiúscula.' })
  @Matches(/[0-9]/, { message: 'A senha deve conter ao menos um número.' })
  password: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe a senha atual.' })
  currentPassword: string;

  @IsString()
  @MinLength(10, { message: 'A senha deve ter ao menos 10 caracteres.' })
  @Matches(/[a-z]/, { message: 'A senha deve conter ao menos uma letra minúscula.' })
  @Matches(/[A-Z]/, { message: 'A senha deve conter ao menos uma letra maiúscula.' })
  @Matches(/[0-9]/, { message: 'A senha deve conter ao menos um número.' })
  newPassword: string;
}

export class RefreshDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
