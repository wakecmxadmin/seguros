import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { RequestContext } from '../auth/auth.service';
import { CreateRoleDto, UpdateRoleDto } from './dto/roles.dto';

@Injectable()
export class RolesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  private format(role: any) {
    const { permissions, _count, ...rest } = role;
    return {
      ...rest,
      permissions: permissions?.map((p: any) => p.permission.slug) ?? [],
      userCount: _count?.users ?? 0,
    };
  }

  async list() {
    const roles = await this.prisma.role.findMany({
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
      orderBy: [{ system: 'desc' }, { name: 'asc' }],
    });
    return roles.map((r) => this.format(r));
  }

  async findOne(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
    });
    if (!role) throw new NotFoundException('Papel não encontrado.');
    return this.format(role);
  }

  /** Catálogo de permissões agrupado por módulo, para montar a tela. */
  async listPermissions() {
    const permissions = await this.prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { resource: 'asc' }, { action: 'asc' }],
    });

    const byModule = new Map<string, typeof permissions>();
    for (const p of permissions) {
      if (!byModule.has(p.module)) byModule.set(p.module, []);
      byModule.get(p.module)!.push(p);
    }

    return [...byModule.entries()].map(([module, items]) => ({
      module,
      permissions: items.map((p) => ({
        slug: p.slug,
        resource: p.resource,
        action: p.action,
        description: p.description,
      })),
    }));
  }

  async create(dto: CreateRoleDto, authorId: string, ctx: RequestContext) {
    const slug = this.toSlug(dto.name);
    if (await this.prisma.role.findUnique({ where: { slug } })) {
      throw new ConflictException('Já existe um papel com este nome.');
    }
    const ids = await this.resolvePermissions(dto.permissions);

    const role = await this.prisma.role.create({
      data: {
        slug,
        name: dto.name.trim(),
        description: dto.description,
        permissions: { create: ids.map((permissionId) => ({ permissionId })) },
      },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
    });

    await this.audit.record({
      userId: authorId,
      action: 'role_created',
      entity: 'Role',
      entityId: role.id,
      after: this.format(role),
      ...ctx,
    });

    return this.format(role);
  }

  async update(
    id: string,
    dto: UpdateRoleDto,
    authorId: string,
    ctx: RequestContext,
  ) {
    const before = await this.prisma.role.findUnique({
      where: { id },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
    });
    if (!before) throw new NotFoundException('Papel não encontrado.');

    const ids = dto.permissions ? await this.resolvePermissions(dto.permissions) : null;

    const after = await this.prisma.role.update({
      where: { id },
      data: {
        // Papéis de sistema podem ter permissões ajustadas, mas não renomeados.
        name: before.system ? undefined : dto.name?.trim(),
        description: dto.description,
        ...(ids
          ? { permissions: { deleteMany: {}, create: ids.map((permissionId) => ({ permissionId })) } }
          : {}),
      },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
    });

    // Alterar permissões afeta quem tem o papel: derruba as sessões desses usuários.
    if (ids) {
      const links = await this.prisma.userRole.findMany({
        where: { roleId: id },
        select: { userId: true },
      });
      if (links.length) {
        await this.prisma.refreshToken.updateMany({
          where: { userId: { in: links.map((l) => l.userId) }, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    }

    await this.audit.record({
      userId: authorId,
      action: 'role_updated',
      entity: 'Role',
      entityId: id,
      before: this.format(before),
      after: this.format(after),
      ...ctx,
    });

    return this.format(after);
  }

  async remove(id: string, authorId: string, ctx: RequestContext) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!role) throw new NotFoundException('Papel não encontrado.');
    if (role.system) {
      throw new BadRequestException('Papéis de sistema não podem ser excluídos.');
    }
    if (role._count.users > 0) {
      throw new BadRequestException(
        `Este papel está atribuído a ${role._count.users} usuário(s). Remova-os antes de excluir.`,
      );
    }

    await this.prisma.role.delete({ where: { id } });
    await this.audit.record({
      userId: authorId,
      action: 'role_deleted',
      entity: 'Role',
      entityId: id,
      before: { slug: role.slug, name: role.name },
      ...ctx,
    });

    return { ok: true };
  }

  private async resolvePermissions(slugs: string[]) {
    if (!slugs.length) throw new BadRequestException('Selecione ao menos uma permissão.');
    const found = await this.prisma.permission.findMany({
      where: { slug: { in: slugs } },
      select: { id: true, slug: true },
    });
    if (found.length !== slugs.length) {
      const missing = slugs.filter((s) => !found.some((f) => f.slug === s));
      throw new BadRequestException(`Permissões inexistentes: ${missing.join(', ')}`);
    }
    return found.map((f) => f.id);
  }

  private toSlug(name: string) {
    return name
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
  }
}
