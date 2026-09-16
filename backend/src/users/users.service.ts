import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PasswordResetType, Prisma, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { AuthService, RequestContext } from '../auth/auth.service';
import { CreateUserDto, ListUsersDto, UpdateUserDto } from './dto/users.dto';

/** Campos devolvidos nas listagens e detalhes. Nunca inclui `password`. */
const selection = {
  id: true,
  name: true,
  email: true,
  document: true,
  type: true,
  status: true,
  phone: true,
  jobTitle: true,
  department: true,
  clientId: true,
  partnerId: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  roles: { select: { role: { select: { id: true, slug: true, name: true } } } },
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private mail: MailService,
    private auth: AuthService,
  ) {}

  private format(user: any) {
    const { roles, ...rest } = user;
    return { ...rest, roles: roles.map((r: any) => r.role) };
  }

  async list(filters: ListUsersDto) {
    const page = filters.page ?? 1;
    const perPage = Math.min(filters.perPage ?? 20, 100);

    const where: Prisma.UserWhereInput = {
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.roleId ? { roles: { some: { roleId: filters.roleId } } } : {}),
      ...(filters.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: 'insensitive' } },
              { email: { contains: filters.search, mode: 'insensitive' } },
              { document: { contains: filters.search.replace(/\D/g, '') } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: selection,
        orderBy: [{ status: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map((u) => this.format(u)),
      total,
      page,
      perPage,
      pages: Math.ceil(total / perPage),
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: selection });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    return this.format(user);
  }

  /**
   * Cria o usuário já com os papéis e dispara o convite de primeiro acesso.
   * O usuário nasce INVITED e só vira ACTIVE ao definir a senha — diferente do
   * legado, em que o admin definia a senha manualmente.
   */
  async create(dto: CreateUserDto, authorId: string, ctx: RequestContext) {
    const email = dto.email.toLowerCase().trim();
    const document = dto.document?.replace(/\D/g, '') || null;

    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new ConflictException('Já existe um usuário com este e-mail.');
    }
    if (document && (await this.prisma.user.findUnique({ where: { document } }))) {
      throw new ConflictException('Já existe um usuário com este CNPJ/CPF.');
    }
    await this.validateRoles(dto.roleIds);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email,
        document,
        type: dto.type,
        status: UserStatus.INVITED,
        phone: dto.phone,
        jobTitle: dto.jobTitle,
        department: dto.department,
        clientId: dto.clientId,
        partnerId: dto.partnerId,
        roles: { create: dto.roleIds.map((roleId) => ({ roleId })) },
      },
      select: selection,
    });

    const token = await this.auth.createPasswordToken(
      user.id,
      PasswordResetType.FIRST_ACCESS,
      ctx,
    );
    await this.mail.sendInvite(user.email, user.name, token);

    await this.audit.record({
      userId: authorId,
      action: 'user_created',
      entity: 'User',
      entityId: user.id,
      after: this.format(user),
      ...ctx,
    });

    return this.format(user);
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    authorId: string,
    ctx: RequestContext,
  ) {
    const before = await this.prisma.user.findUnique({ where: { id }, select: selection });
    if (!before) throw new NotFoundException('Usuário não encontrado.');

    const email = dto.email?.toLowerCase().trim();
    const document =
      dto.document !== undefined ? dto.document?.replace(/\D/g, '') || null : undefined;

    if (email && email !== before.email) {
      if (await this.prisma.user.findUnique({ where: { email } })) {
        throw new ConflictException('Já existe um usuário com este e-mail.');
      }
    }
    if (document && document !== before.document) {
      if (await this.prisma.user.findUnique({ where: { document } })) {
        throw new ConflictException('Já existe um usuário com este CNPJ/CPF.');
      }
    }
    if (dto.roleIds) await this.validateRoles(dto.roleIds);

    const after = await this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        email,
        document,
        type: dto.type,
        phone: dto.phone,
        jobTitle: dto.jobTitle,
        department: dto.department,
        clientId: dto.clientId,
        partnerId: dto.partnerId,
        ...(dto.roleIds
          ? { roles: { deleteMany: {}, create: dto.roleIds.map((roleId) => ({ roleId })) } }
          : {}),
      },
      select: selection,
    });

    // Trocar papéis muda as permissões: derruba as sessões para reemitir o token.
    if (dto.roleIds) await this.auth.revokeAllSessions(id);

    await this.audit.record({
      userId: authorId,
      action: 'user_updated',
      entity: 'User',
      entityId: id,
      before: this.format(before),
      after: this.format(after),
      ...ctx,
    });

    return this.format(after);
  }

  /**
   * Desativa ou reativa. Nunca excluímos usuários: eles são referenciados pela
   * trilha de auditoria e, futuramente, pelos processos que criaram.
   */
  async toggleStatus(
    id: string,
    active: boolean,
    authorId: string,
    ctx: RequestContext,
  ) {
    if (id === authorId && !active) {
      throw new BadRequestException('Você não pode desativar a própria conta.');
    }

    const before = await this.prisma.user.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Usuário não encontrado.');

    const after = await this.prisma.user.update({
      where: { id },
      data: {
        // Quem nunca definiu senha volta para INVITED ao ser reativado.
        status: active
          ? before.password
            ? UserStatus.ACTIVE
            : UserStatus.INVITED
          : UserStatus.INACTIVE,
        deactivatedAt: active ? null : new Date(),
      },
      select: selection,
    });

    if (!active) await this.auth.revokeAllSessions(id);

    await this.audit.record({
      userId: authorId,
      action: active ? 'user_reactivated' : 'user_deactivated',
      entity: 'User',
      entityId: id,
      ...ctx,
    });

    return this.format(after);
  }

  /** Dispara um novo link de definição de senha (substitui o "Zerar Senha" do legado). */
  async resendAccess(id: string, authorId: string, ctx: RequestContext) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    if (user.status === UserStatus.INACTIVE) {
      throw new BadRequestException('Não é possível enviar acesso a um usuário inativo.');
    }

    const firstAccess = !user.password;
    const token = await this.auth.createPasswordToken(
      user.id,
      firstAccess ? PasswordResetType.FIRST_ACCESS : PasswordResetType.RECOVERY,
      ctx,
    );

    if (firstAccess) {
      await this.mail.sendInvite(user.email, user.name, token);
    } else {
      await this.mail.sendPasswordRecovery(user.email, user.name, token);
    }

    await this.audit.record({
      userId: authorId,
      action: 'user_access_resent',
      entity: 'User',
      entityId: id,
      ...ctx,
    });

    return { ok: true, message: `Link enviado para ${user.email}.` };
  }

  private async validateRoles(roleIds: string[]) {
    if (!roleIds.length) {
      throw new BadRequestException('Selecione ao menos um papel.');
    }
    const found = await this.prisma.role.count({ where: { id: { in: roleIds } } });
    if (found !== roleIds.length) {
      throw new BadRequestException('Um ou mais papéis informados não existem.');
    }
  }
}
