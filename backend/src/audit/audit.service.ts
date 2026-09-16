import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditRecord {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Registra uma ação na trilha de auditoria.
   * Falha silenciosamente: auditoria nunca deve derrubar a operação de negócio.
   */
  async record(entry: AuditRecord): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: entry.userId ?? null,
          action: entry.action,
          entity: entry.entity,
          entityId: entry.entityId ?? null,
          before: (entry.before ?? undefined) as any,
          after: (entry.after ?? undefined) as any,
          ip: entry.ip ?? null,
          userAgent: entry.userAgent ?? null,
        },
      });
    } catch (error) {
      this.logger.error(`Falha ao registrar auditoria (${entry.action})`, error as Error);
    }
  }

  /** Valores distintos de ação e entidade, para alimentar os filtros da tela. */
  async facets() {
    const [actions, entities] = await Promise.all([
      this.prisma.auditLog.findMany({
        distinct: ['action'],
        select: { action: true },
        orderBy: { action: 'asc' },
      }),
      this.prisma.auditLog.findMany({
        distinct: ['entity'],
        select: { entity: true },
        orderBy: { entity: 'asc' },
      }),
    ]);

    return {
      actions: actions.map((a) => a.action),
      entities: entities.map((e) => e.entity),
    };
  }

  async list(params: {
    entity?: string;
    entityId?: string;
    userId?: string;
    action?: string;
    page?: number;
    perPage?: number;
  }) {
    const page = params.page ?? 1;
    const perPage = Math.min(params.perPage ?? 50, 200);

    const where = {
      ...(params.entity ? { entity: params.entity } : {}),
      ...(params.entityId ? { entityId: params.entityId } : {}),
      ...(params.userId ? { userId: params.userId } : {}),
      ...(params.action ? { action: params.action } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total, page, perPage, pages: Math.ceil(total / perPage) };
  }
}
