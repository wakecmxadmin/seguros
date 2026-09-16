import {
  BadRequestException, ConflictException, Injectable, NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { RequestContext } from '../auth/auth.service';
import {
  CreateCoverageDto, CreatePolicyDto, ListPoliciesDto, UpdateCoverageDto, UpdatePolicyDto,
} from './dto/policies.dto';
import { CreateClientRateDto, UpdateClientRateDto } from './dto/client-rates.dto';
import { describeScope, resolveClientRate } from './rate-resolver';

const policyInclude = {
  insurer: { select: { id: true, legalName: true, tradeName: true } },
  _count: { select: { quotes: true } },
} satisfies Prisma.PolicyInclude;

@Injectable()
export class PoliciesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  // --- Apólices -------------------------------------------------------------

  async list(filters: ListPoliciesDto) {
    const page = filters.page ?? 1;
    const perPage = Math.min(filters.perPage ?? 25, 200);

    const where: Prisma.PolicyWhereInput = {
      ...(filters.kind ? { kind: filters.kind } : {}),
      ...(filters.insurerId ? { insurerId: filters.insurerId } : {}),
      ...(filters.active === 'true' ? { active: true } : {}),
      ...(filters.active === 'false' ? { active: false } : {}),
      ...(filters.search
        ? {
            OR: [
              { number: { contains: filters.search, mode: 'insensitive' } },
              { description: { contains: filters.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.policy.findMany({
        where,
        include: policyInclude,
        orderBy: [{ active: 'desc' }, { number: 'asc' }],
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.policy.count({ where }),
    ]);

    return { items, total, page, perPage, pages: Math.ceil(total / perPage) };
  }

  /** Apólices vigentes para o select da cotação. */
  async options(kind?: string, insurerId?: string) {
    const today = new Date();
    const items = await this.prisma.policy.findMany({
      where: {
        active: true,
        ...(kind ? { kind: kind as any } : {}),
        ...(insurerId ? { insurerId } : {}),
        AND: [
          { OR: [{ validFrom: null }, { validFrom: { lte: today } }] },
          { OR: [{ validTo: null }, { validTo: { gte: today } }] },
        ],
      },
      include: { insurer: { select: { id: true, legalName: true, tradeName: true } } },
      orderBy: { number: 'asc' },
    });

    return items.map((p) => ({
      id: p.id,
      label: p.number,
      sublabel: p.description ?? p.insurer.tradeName ?? p.insurer.legalName,
      insurerId: p.insurerId,
      baseRateClient: p.baseRateClient,
      baseRateInsurer: p.baseRateInsurer,
      minimumPremium: p.minimumPremium,
    }));
  }

  async create(dto: CreatePolicyDto, authorId: string, ctx: RequestContext) {
    await this.assertInsurer(dto.insurerId);

    const duplicate = await this.prisma.policy.findFirst({
      where: { number: dto.number, insurerId: dto.insurerId },
    });
    if (duplicate) {
      throw new ConflictException('Já existe uma apólice com este número para esta seguradora.');
    }

    const policy = await this.prisma.policy.create({
      data: this.payload(dto) as Prisma.PolicyCreateInput,
      include: policyInclude,
    });

    await this.audit.record({
      userId: authorId,
      action: 'policy_created',
      entity: 'Policy',
      entityId: policy.id,
      after: policy,
      ...ctx,
    });
    return policy;
  }

  async update(id: string, dto: UpdatePolicyDto, authorId: string, ctx: RequestContext) {
    const before = await this.prisma.policy.findUnique({ where: { id }, include: policyInclude });
    if (!before) throw new NotFoundException('Apólice não encontrada.');
    if (dto.insurerId) await this.assertInsurer(dto.insurerId);

    const after = await this.prisma.policy.update({
      where: { id },
      data: this.payload(dto),
      include: policyInclude,
    });

    await this.audit.record({
      userId: authorId,
      action: 'policy_updated',
      entity: 'Policy',
      entityId: id,
      before,
      after,
      ...ctx,
    });
    return after;
  }

  async remove(id: string, authorId: string, ctx: RequestContext) {
    const policy = await this.prisma.policy.findUnique({
      where: { id },
      include: { _count: { select: { quotes: true } } },
    });
    if (!policy) throw new NotFoundException('Apólice não encontrada.');
    if (policy._count.quotes > 0) {
      throw new BadRequestException(
        `Esta apólice tem ${policy._count.quotes} cotação(ões) vinculada(s). Desative-a.`,
      );
    }

    await this.prisma.policy.delete({ where: { id } });
    await this.audit.record({
      userId: authorId,
      action: 'policy_deleted',
      entity: 'Policy',
      entityId: id,
      before: { number: policy.number },
      ...ctx,
    });
    return { ok: true };
  }

  private payload(dto: CreatePolicyDto | UpdatePolicyDto): any {
    return {
      number: dto.number?.trim(),
      description: dto.description,
      kind: dto.kind,
      insurerId: dto.insurerId,
      insuredLimit: dto.insuredLimit,
      brokerCode: dto.brokerCode,
      baseRateClient: dto.baseRateClient,
      baseRateInsurer: dto.baseRateInsurer,
      minimumPremium: dto.minimumPremium,
      minimumPremiumCurrencyId: dto.minimumPremiumCurrencyId,
      validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
      validTo: dto.validTo ? new Date(dto.validTo) : undefined,
      active: dto.active,
    };
  }

  private async assertInsurer(insurerId: string) {
    const insurer = await this.prisma.company.findUnique({
      where: { id: insurerId },
      include: { roles: true },
    });
    if (!insurer) throw new BadRequestException('Seguradora não encontrada.');
    if (!insurer.roles.some((r) => r.role === 'INSURER')) {
      throw new BadRequestException(
        `"${insurer.legalName}" não tem o papel de seguradora. Ajuste o cadastro da empresa.`,
      );
    }
  }

  // --- Coberturas -----------------------------------------------------------

  async listCoverages() {
    return this.prisma.coverage.findMany({
      orderBy: [{ accessory: 'asc' }, { name: 'asc' }],
    });
  }

  async createCoverage(dto: CreateCoverageDto, authorId: string, ctx: RequestContext) {
    const existing = await this.prisma.coverage.findUnique({ where: { name: dto.name.trim() } });
    if (existing) throw new ConflictException('Já existe uma cobertura com este nome.');

    const coverage = await this.prisma.coverage.create({
      data: { ...dto, name: dto.name.trim() },
    });
    await this.audit.record({
      userId: authorId,
      action: 'coverage_created',
      entity: 'Coverage',
      entityId: coverage.id,
      after: coverage,
      ...ctx,
    });
    return coverage;
  }

  async updateCoverage(id: string, dto: UpdateCoverageDto, authorId: string, ctx: RequestContext) {
    const before = await this.prisma.coverage.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Cobertura não encontrada.');

    const after = await this.prisma.coverage.update({
      where: { id },
      data: { ...dto, name: dto.name?.trim() },
    });
    await this.audit.record({
      userId: authorId,
      action: 'coverage_updated',
      entity: 'Coverage',
      entityId: id,
      before,
      after,
      ...ctx,
    });
    return after;
  }

  // --- Taxas por cliente ----------------------------------------------------

  private clientRateInclude = {
    client: { select: { id: true, legalName: true, tradeName: true } },
    policy: { select: { id: true, number: true } },
    coverage: { select: { id: true, name: true } },
    commodityType: { select: { id: true, name: true } },
  };

  /** Regras de um cliente, da mais específica para a mais geral. */
  async listClientRates(clientId?: string) {
    const rates = await this.prisma.clientRate.findMany({
      where: clientId ? { clientId } : {},
      include: this.clientRateInclude,
      orderBy: [{ clientId: 'asc' }, { createdAt: 'desc' }],
    });

    return rates.map((rate) => ({
      ...rate,
      scope: describeScope(rate as any, {
        policy: rate.policy?.number,
        coverage: rate.coverage?.name,
        commodityType: rate.commodityType?.name,
      }),
    }));
  }

  /**
   * Simula qual regra o motor escolheria para um contexto — ajuda o operador
   * a entender por que uma taxa foi aplicada.
   */
  async previewClientRate(clientId: string, context: Record<string, any>) {
    const rates = await this.prisma.clientRate.findMany({
      where: { clientId, active: true },
      include: this.clientRateInclude,
    });

    const chosen = resolveClientRate(rates as any, {
      policyId: context.policyId ?? null,
      coverageId: context.coverageId ?? null,
      commodityTypeId: context.commodityTypeId ?? null,
      modal: context.modal ?? null,
      kind: context.kind ?? null,
    });

    if (!chosen) return { found: false, rate: null };

    const full = rates.find((r) => r.id === chosen.id)!;
    return {
      found: true,
      rate: {
        ...full,
        scope: describeScope(full as any, {
          policy: full.policy?.number,
          coverage: full.coverage?.name,
          commodityType: full.commodityType?.name,
        }),
      },
    };
  }

  async createClientRate(dto: CreateClientRateDto, authorId: string, ctx: RequestContext) {
    const created = await this.prisma.clientRate.create({
      data: this.clientRatePayload(dto),
      include: this.clientRateInclude,
    });

    await this.audit.record({
      userId: authorId,
      action: 'client_rate_created',
      entity: 'ClientRate',
      entityId: created.id,
      after: created,
      ...ctx,
    });

    return created;
  }

  async updateClientRate(
    id: string,
    dto: UpdateClientRateDto,
    authorId: string,
    ctx: RequestContext,
  ) {
    const before = await this.prisma.clientRate.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Taxa não encontrada.');

    const after = await this.prisma.clientRate.update({
      where: { id },
      data: this.clientRatePayload(dto),
      include: this.clientRateInclude,
    });

    await this.audit.record({
      userId: authorId,
      action: 'client_rate_updated',
      entity: 'ClientRate',
      entityId: id,
      before,
      after,
      ...ctx,
    });

    return after;
  }

  async removeClientRate(id: string, authorId: string, ctx: RequestContext) {
    const rate = await this.prisma.clientRate.findUnique({ where: { id } });
    if (!rate) throw new NotFoundException('Taxa não encontrada.');

    await this.prisma.clientRate.delete({ where: { id } });
    await this.audit.record({
      userId: authorId,
      action: 'client_rate_deleted',
      entity: 'ClientRate',
      entityId: id,
      before: rate,
      ...ctx,
    });

    return { ok: true };
  }

  private clientRatePayload(dto: CreateClientRateDto | UpdateClientRateDto): any {
    return {
      clientId: dto.clientId,
      // `null` limpa o escopo; `undefined` mantém o valor atual.
      policyId: dto.policyId ?? null,
      coverageId: dto.coverageId ?? null,
      commodityTypeId: dto.commodityTypeId ?? null,
      modal: dto.modal ?? null,
      kind: dto.kind ?? null,
      rateClient: dto.rateClient,
      rateInsurer: dto.rateInsurer ?? 0,
      minimumPremium: dto.minimumPremium ?? null,
      validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
      validTo: dto.validTo ? new Date(dto.validTo) : null,
      active: dto.active ?? true,
      notes: dto.notes ?? null,
    };
  }
}
