import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CompanyRoleType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { RequestContext } from '../auth/auth.service';
import { CreateCompanyDto, ListCompaniesDto, UpdateCompanyDto } from './dto/companies.dto';

const selection = {
  id: true,
  legalName: true,
  tradeName: true,
  document: true,
  stateReg: true,
  email: true,
  phone: true,
  mobile: true,
  zipCode: true,
  address: true,
  number: true,
  district: true,
  cityName: true,
  stateName: true,
  countryName: true,
  notes: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  roles: { select: { role: true } },
} satisfies Prisma.CompanySelect;

@Injectable()
export class CompaniesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  private format(company: any) {
    const { roles, ...rest } = company;
    return { ...rest, roles: roles.map((r: any) => r.role) };
  }

  async list(filters: ListCompaniesDto) {
    const page = filters.page ?? 1;
    const perPage = Math.min(filters.perPage ?? 25, 200);

    const where: Prisma.CompanyWhereInput = {
      ...(filters.role ? { roles: { some: { role: filters.role } } } : {}),
      ...(filters.active === 'true' ? { active: true } : {}),
      ...(filters.active === 'false' ? { active: false } : {}),
      ...(filters.search
        ? {
            OR: [
              { legalName: { contains: filters.search, mode: 'insensitive' } },
              { tradeName: { contains: filters.search, mode: 'insensitive' } },
              { document: { contains: filters.search.replace(/\D/g, '') } },
              { email: { contains: filters.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        select: selection,
        orderBy: [{ active: 'desc' }, { legalName: 'asc' }],
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.company.count({ where }),
    ]);

    return {
      items: items.map((c) => this.format(c)),
      total,
      page,
      perPage,
      pages: Math.ceil(total / perPage),
    };
  }

  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({ where: { id }, select: selection });
    if (!company) throw new NotFoundException('Empresa não encontrada.');
    return this.format(company);
  }

  /** Opções para selects, filtradas por papel (cliente, parceiro, seguradora…). */
  async options(role?: CompanyRoleType, search?: string) {
    const items = await this.prisma.company.findMany({
      where: {
        active: true,
        ...(role ? { roles: { some: { role } } } : {}),
        ...(search
          ? {
              OR: [
                { legalName: { contains: search, mode: 'insensitive' } },
                { tradeName: { contains: search, mode: 'insensitive' } },
                { document: { contains: search.replace(/\D/g, '') } },
              ],
            }
          : {}),
      },
      select: { id: true, legalName: true, tradeName: true, document: true },
      orderBy: { legalName: 'asc' },
      take: 50,
    });

    return items.map((c) => ({
      id: c.id,
      label: c.tradeName || c.legalName,
      sublabel: c.legalName,
      document: c.document,
    }));
  }

  async create(dto: CreateCompanyDto, authorId: string, ctx: RequestContext) {
    const document = dto.document?.replace(/\D/g, '') || null;

    if (document) {
      const existing = await this.prisma.company.findUnique({ where: { document } });
      if (existing) {
        throw new ConflictException(
          `Já existe uma empresa com este CNPJ/CPF: ${existing.legalName}. ` +
            `Adicione o papel desejado ao cadastro existente em vez de duplicá-lo.`,
        );
      }
    }
    this.assertRoles(dto.roles);

    const company = await this.prisma.company.create({
      data: {
        ...this.payload(dto),
        document,
        roles: { create: dto.roles.map((role) => ({ role })) },
      },
      select: selection,
    });

    await this.audit.record({
      userId: authorId,
      action: 'company_created',
      entity: 'Company',
      entityId: company.id,
      after: this.format(company),
      ...ctx,
    });

    return this.format(company);
  }

  async update(id: string, dto: UpdateCompanyDto, authorId: string, ctx: RequestContext) {
    const before = await this.prisma.company.findUnique({ where: { id }, select: selection });
    if (!before) throw new NotFoundException('Empresa não encontrada.');

    const document =
      dto.document !== undefined ? dto.document?.replace(/\D/g, '') || null : undefined;

    if (document && document !== before.document) {
      const existing = await this.prisma.company.findUnique({ where: { document } });
      if (existing) {
        throw new ConflictException(`Já existe uma empresa com este CNPJ/CPF: ${existing.legalName}.`);
      }
    }
    if (dto.roles) this.assertRoles(dto.roles);

    const after = await this.prisma.company.update({
      where: { id },
      data: {
        ...this.payload(dto),
        document,
        ...(dto.roles
          ? { roles: { deleteMany: {}, create: dto.roles.map((role) => ({ role })) } }
          : {}),
      },
      select: selection,
    });

    await this.audit.record({
      userId: authorId,
      action: 'company_updated',
      entity: 'Company',
      entityId: id,
      before: this.format(before),
      after: this.format(after),
      ...ctx,
    });

    return this.format(after);
  }

  async remove(id: string, authorId: string, ctx: RequestContext) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        _count: {
          select: { clientQuotes: true, partnerQuotes: true, insurerQuotes: true, policies: true },
        },
      },
    });
    if (!company) throw new NotFoundException('Empresa não encontrada.');

    const inUse =
      company._count.clientQuotes +
      company._count.partnerQuotes +
      company._count.insurerQuotes +
      company._count.policies;

    if (inUse > 0) {
      throw new BadRequestException(
        `Esta empresa tem ${inUse} registro(s) vinculado(s) e não pode ser excluída. Desative-a.`,
      );
    }

    await this.prisma.company.delete({ where: { id } });
    await this.audit.record({
      userId: authorId,
      action: 'company_deleted',
      entity: 'Company',
      entityId: id,
      before: { legalName: company.legalName, document: company.document },
      ...ctx,
    });

    return { ok: true };
  }

  private payload(dto: CreateCompanyDto | UpdateCompanyDto) {
    return {
      legalName: dto.legalName?.trim(),
      tradeName: dto.tradeName,
      stateReg: dto.stateReg,
      email: dto.email,
      phone: dto.phone,
      mobile: dto.mobile,
      zipCode: dto.zipCode?.replace(/\D/g, ''),
      address: dto.address,
      number: dto.number,
      district: dto.district,
      cityName: dto.cityName,
      stateName: dto.stateName,
      countryName: dto.countryName,
      notes: dto.notes,
      active: dto.active,
    };
  }

  private assertRoles(roles: CompanyRoleType[]) {
    if (!roles?.length) {
      throw new BadRequestException(
        'Selecione ao menos um papel (cliente, parceiro, seguradora, transportadora ou vistoriador).',
      );
    }
  }
}
