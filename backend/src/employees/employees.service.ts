import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { RequestContext } from '../auth/auth.service';
import { CreateEmployeeDto, ListEmployeesDto, UpdateEmployeeDto } from './dto/employees.dto';

@Injectable()
export class EmployeesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async list(filters: ListEmployeesDto) {
    const page = filters.page ?? 1;
    const perPage = Math.min(filters.perPage ?? 50, 200);

    const where: Prisma.EmployeeWhereInput = {
      ...(filters.active === 'true' ? { active: true } : {}),
      ...(filters.active === 'false' ? { active: false } : {}),
      ...(filters.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: 'insensitive' } },
              { email: { contains: filters.search, mode: 'insensitive' } },
              { department: { contains: filters.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        orderBy: [{ active: 'desc' }, { name: 'asc' }],
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.employee.count({ where }),
    ]);

    return { items, total, page, perPage, pages: Math.ceil(total / perPage) };
  }

  /** Vendedores para o select das cotações. */
  async salespeople() {
    const items = await this.prisma.employee.findMany({
      where: { active: true, isSalesperson: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    return items.map((e) => ({ id: e.id, label: e.name }));
  }

  async create(dto: CreateEmployeeDto, authorId: string, ctx: RequestContext) {
    const employee = await this.prisma.employee.create({
      data: { ...dto, name: dto.name.trim() },
    });
    await this.audit.record({
      userId: authorId,
      action: 'employee_created',
      entity: 'Employee',
      entityId: employee.id,
      after: employee,
      ...ctx,
    });
    return employee;
  }

  async update(id: string, dto: UpdateEmployeeDto, authorId: string, ctx: RequestContext) {
    const before = await this.prisma.employee.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Funcionário não encontrado.');

    const after = await this.prisma.employee.update({
      where: { id },
      data: { ...dto, name: dto.name?.trim() },
    });

    await this.audit.record({
      userId: authorId,
      action: 'employee_updated',
      entity: 'Employee',
      entityId: id,
      before,
      after,
      ...ctx,
    });
    return after;
  }

  async remove(id: string, authorId: string, ctx: RequestContext) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: { _count: { select: { quotes: true } } },
    });
    if (!employee) throw new NotFoundException('Funcionário não encontrado.');
    if (employee._count.quotes > 0) {
      throw new BadRequestException(
        `Este funcionário está vinculado a ${employee._count.quotes} cotação(ões). Desative-o.`,
      );
    }

    await this.prisma.employee.delete({ where: { id } });
    await this.audit.record({
      userId: authorId,
      action: 'employee_deleted',
      entity: 'Employee',
      entityId: id,
      before: employee,
      ...ctx,
    });
    return { ok: true };
  }
}
