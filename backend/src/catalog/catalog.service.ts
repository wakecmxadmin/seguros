import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { RequestContext } from '../auth/auth.service';

/**
 * Entidades simples do catálogo, todas com o mesmo formato de CRUD.
 * Centralizar aqui evita repetir oito services praticamente idênticos —
 * no legado cada uma dessas era uma tela solta na sidebar.
 */
export const CATALOG_ENTITIES = {
  countries: {
    model: 'country',
    label: 'País',
    searchFields: ['name', 'iso2', 'iso3'],
    orderBy: [{ name: 'asc' }],
  },
  states: {
    model: 'state',
    label: 'Estado',
    searchFields: ['name', 'code'],
    orderBy: [{ name: 'asc' }],
    include: { country: { select: { id: true, name: true } } },
  },
  cities: {
    model: 'city',
    label: 'Cidade',
    searchFields: ['name'],
    orderBy: [{ name: 'asc' }],
    include: {
      state: { select: { id: true, name: true, country: { select: { id: true, name: true } } } },
    },
  },
  ports: {
    model: 'port',
    label: 'Porto/Aeroporto',
    searchFields: ['name', 'code'],
    orderBy: [{ name: 'asc' }],
    include: {
      country: { select: { id: true, name: true } },
      city: { select: { id: true, name: true } },
    },
  },
  currencies: {
    model: 'currency',
    label: 'Moeda',
    searchFields: ['name', 'code'],
    orderBy: [{ code: 'asc' }],
  },
  packagings: {
    model: 'packaging',
    label: 'Embalagem',
    searchFields: ['name'],
    orderBy: [{ name: 'asc' }],
  },
  vessels: {
    model: 'vessel',
    label: 'Navio',
    searchFields: ['name', 'imo'],
    orderBy: [{ name: 'asc' }],
  },
  'commodity-types': {
    model: 'commodityType',
    label: 'Tipo de mercadoria',
    searchFields: ['name', 'code'],
    orderBy: [{ name: 'asc' }],
  },
} as const;

export type CatalogEntity = keyof typeof CATALOG_ENTITIES;

@Injectable()
export class CatalogService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  private config(entity: string) {
    const config = CATALOG_ENTITIES[entity as CatalogEntity];
    if (!config) {
      throw new NotFoundException(`Cadastro "${entity}" não existe.`);
    }
    return config;
  }

  private delegate(entity: string): any {
    return (this.prisma as any)[this.config(entity).model];
  }

  async list(
    entity: string,
    params: { search?: string; active?: string; page?: number; perPage?: number; parentId?: string },
  ) {
    const config = this.config(entity);
    const delegate = this.delegate(entity);

    const page = params.page ?? 1;
    const perPage = Math.min(params.perPage ?? 50, 500);

    const where: any = {};

    if (params.search) {
      where.OR = config.searchFields.map((field) => ({
        [field]: { contains: params.search, mode: 'insensitive' },
      }));
    }
    if (params.active === 'true') where.active = true;
    if (params.active === 'false') where.active = false;

    // Filtro pelo pai, para as listas encadeadas (estados de um país, cidades de um estado…).
    if (params.parentId) {
      if (entity === 'states') where.countryId = params.parentId;
      else if (entity === 'cities') where.stateId = params.parentId;
      else if (entity === 'ports') where.countryId = params.parentId;
    }

    const [items, total] = await Promise.all([
      delegate.findMany({
        where,
        ...('include' in config ? { include: config.include } : {}),
        orderBy: config.orderBy,
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      delegate.count({ where }),
    ]);

    return { items, total, page, perPage, pages: Math.ceil(total / perPage) };
  }

  async create(entity: string, data: any, authorId: string, ctx: RequestContext) {
    const config = this.config(entity);
    try {
      const created = await this.delegate(entity).create({ data });
      await this.audit.record({
        userId: authorId,
        action: 'catalog_created',
        entity: config.model,
        entityId: created.id,
        after: created,
        ...ctx,
      });
      return created;
    } catch (error) {
      throw this.translateError(error, config.label);
    }
  }

  async update(entity: string, id: string, data: any, authorId: string, ctx: RequestContext) {
    const config = this.config(entity);
    const before = await this.delegate(entity).findUnique({ where: { id } });
    if (!before) throw new NotFoundException(`${config.label} não encontrado.`);

    try {
      const after = await this.delegate(entity).update({ where: { id }, data });
      await this.audit.record({
        userId: authorId,
        action: 'catalog_updated',
        entity: config.model,
        entityId: id,
        before,
        after,
        ...ctx,
      });
      return after;
    } catch (error) {
      throw this.translateError(error, config.label);
    }
  }

  async remove(entity: string, id: string, authorId: string, ctx: RequestContext) {
    const config = this.config(entity);
    const before = await this.delegate(entity).findUnique({ where: { id } });
    if (!before) throw new NotFoundException(`${config.label} não encontrado.`);

    try {
      await this.delegate(entity).delete({ where: { id } });
    } catch (error) {
      // Registro em uso por outra tabela: desativar é o caminho, não excluir.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2003' || error.code === 'P2014')
      ) {
        throw new BadRequestException(
          `Este registro está em uso e não pode ser excluído. Desative-o em vez de excluir.`,
        );
      }
      throw error;
    }

    await this.audit.record({
      userId: authorId,
      action: 'catalog_deleted',
      entity: config.model,
      entityId: id,
      before,
      ...ctx,
    });

    return { ok: true };
  }

  private translateError(error: unknown, label: string) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return new ConflictException(`Já existe um registro de ${label} com estes dados.`);
      }
      if (error.code === 'P2003') {
        return new BadRequestException('Referência inválida: verifique os campos relacionados.');
      }
    }
    return error as Error;
  }

  /** Opções resumidas para preencher selects no frontend. */
  async options(entity: string, parentId?: string) {
    const config = this.config(entity);
    const where: any = { active: true };

    if (parentId) {
      if (entity === 'states') where.countryId = parentId;
      else if (entity === 'cities') where.stateId = parentId;
      else if (entity === 'ports') where.countryId = parentId;
    }

    const items = await this.delegate(entity).findMany({
      where,
      orderBy: config.orderBy,
      take: 1000,
    });

    return items.map((i: any) => ({
      id: i.id,
      label: i.name ?? i.code,
      code: i.code ?? null,
      modal: i.modal ?? null,
    }));
  }
}
