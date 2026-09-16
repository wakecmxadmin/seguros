import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

function context(req: Request) {
  return {
    ip: req.ip ?? null,
    userAgent: req.get('user-agent') ?? null,
  };
}

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, context(req));
  }

  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.auth.refresh(dto.refreshToken, context(req));
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@Body() dto: Partial<RefreshDto>, @CurrentUser('id') userId: string) {
    return this.auth.logout(dto?.refreshToken, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser('id') userId: string) {
    return this.auth.profile(userId);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    return this.auth.forgotPassword(dto, context(req));
  }

  /** Usado pelas telas de redefinição e primeiro acesso para validar o link. */
  @Public()
  @Get('validate-token')
  validateToken(@Query('token') token: string) {
    return this.auth.validatePasswordToken(token);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    return this.auth.resetPassword(dto, context(req));
  }

  // --- Sessões ativas -------------------------------------------------------

  /** O refresh token vai por query para não exigir corpo em um GET. */
  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  sessions(@CurrentUser('id') userId: string, @Query('refreshToken') refreshToken?: string) {
    return this.auth.listSessions(userId, refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('sessions/:id')
  revokeSession(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Req() req: Request,
  ) {
    return this.auth.revokeSession(userId, id, context(req));
  }

  @UseGuards(JwtAuthGuard)
  @Post('sessions/revoke-others')
  revokeOtherSessions(
    @Body() dto: Partial<RefreshDto>,
    @CurrentUser('id') userId: string,
    @Req() req: Request,
  ) {
    return this.auth.revokeOtherSessions(userId, dto?.refreshToken, context(req));
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser('id') userId: string,
    @Req() req: Request,
  ) {
    return this.auth.changePassword(userId, dto, context(req));
  }
}
