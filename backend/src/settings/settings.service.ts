import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { RequestContext } from '../auth/auth.service';

/**
 * Parâmetros de negócio ajustáveis sem deploy.
 *
 * Os valores default vieram das anotações da reunião (docs/12-reuniao-cliente.md)
 * e ainda precisam de confirmação do cliente — por isso são configuráveis.
 */
export const SETTINGS = {
  'finance.surcharge_percent': {
    label: 'Acréscimo sobre o valor da seguradora',
    description:
      'Aplicado no numerário e no extrato mensal. O campo no sistema antigo se chama "Agravo20" (20%), mas a tela exibe 25%. A confirmar com o cliente.',
    default: '25',
    unit: '%',
  },
  'deadline.tfa_days': {
    label: 'Prazo de TFA (liberação de avarias)',
    description: 'Dias contados a partir da atracação. Anotação da reunião: "atracações em até 15 dias".',
    default: '15',
    unit: 'dias',
  },
  'deadline.release_days': {
    label: 'Prazo de liberação',
    description: 'Dias contados a partir da atracação. Anotação da reunião: "liberações em até 10 dias".',
    default: '10',
    unit: 'dias',
  },
} as const;

export type SettingKey = keyof typeof SETTINGS;

@Injectable()
export class SettingsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  /** Lista com os valores atuais e os defaults, para a tela de configuração. */
  async list() {
    const stored = await this.prisma.systemSetting.findMany();
    const byKey = new Map(stored.map((s) => [s.key, s.value]));

    return Object.entries(SETTINGS).map(([key, meta]) => ({
      key,
      label: meta.label,
      description: meta.description,
      unit: meta.unit,
      value: byKey.get(key) ?? meta.default,
      isDefault: !byKey.has(key),
      default: meta.default,
    }));
  }

  /** Valor numérico de um parâmetro, com fallback para o default. */
  async number(key: SettingKey): Promise<number> {
    const stored = await this.prisma.systemSetting.findUnique({ where: { key } });
    const raw = stored?.value ?? SETTINGS[key].default;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : Number(SETTINGS[key].default);
  }

  async set(key: string, value: string, userId: string, ctx: RequestContext) {
    if (!(key in SETTINGS)) {
      throw new NotFoundException(`Parâmetro "${key}" não existe.`);
    }

    const before = await this.prisma.systemSetting.findUnique({ where: { key } });

    const setting = await this.prisma.systemSetting.upsert({
      where: { key },
      update: { value, updatedById: userId },
      create: {
        key,
        value,
        description: SETTINGS[key as SettingKey].label,
        updatedById: userId,
      },
    });

    await this.audit.record({
      userId,
      action: 'setting_changed',
      entity: 'SystemSetting',
      entityId: key,
      before: { value: before?.value ?? SETTINGS[key as SettingKey].default },
      after: { value },
      ...ctx,
    });

    return setting;
  }
}
