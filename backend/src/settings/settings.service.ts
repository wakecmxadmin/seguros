import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { RequestContext } from '../auth/auth.service';

/**
 * Parâmetros de negócio ajustáveis sem deploy.
 *
 * Os valores default vieram das anotações da reunião (docs/12-reuniao-cliente.md)
 * e da confirmação do cliente sobre o agravo (03/11/2026). Ficam configuráveis
 * porque mudam por negociação com a seguradora, sem exigir release.
 *
 * Os decimais são escritos no formato pt-BR ("0,25") — `parseDecimal` aceita
 * vírgula e ponto, então o operador pode digitar do jeito que estiver acostumado.
 */
export const SETTINGS = {
  'insurance.payable_discount_import_percent': {
    label: 'Agravo — Importação',
    description:
      'Desconto que a seguradora concede sobre o prêmio, reduzindo o valor a pagar a ela. Aplicado automaticamente nas cotações e averbações de importação.',
    default: '0,25',
    unit: '%',
    group: 'Agravo (desconto da seguradora)',
  },
  'insurance.payable_discount_export_percent': {
    label: 'Agravo — Exportação',
    description:
      'Desconto concedido pela seguradora nas operações de exportação. Aplicado automaticamente nas cotações e averbações de exportação.',
    default: '0,30',
    unit: '%',
    group: 'Agravo (desconto da seguradora)',
  },
  'finance.surcharge_percent': {
    label: 'Acréscimo do extrato mensal',
    description:
      'Acréscimo sobre o prêmio do cliente no extrato mensal. Não é o agravo: o agravo é desconto que a seguradora dá à corretora, este é acréscimo cobrado do cliente. Percentual ainda a confirmar.',
    default: '25',
    unit: '%',
    group: 'Financeiro',
  },
  'deadline.tfa_days': {
    label: 'Prazo de TFA (liberação de avarias)',
    description: 'Dias contados a partir da atracação. Anotação da reunião: "atracações em até 15 dias".',
    default: '15',
    unit: 'dias',
    group: 'Prazos',
  },
  'deadline.endorsement_days': {
    label: 'Prazo de averbação',
    description:
      'Dias a partir da chegada/atracação para notificar a seguradora (Cia). Confirmado pelo cliente em 03/11/2026: 15 dias. Antes se chamava "prazo de liberação" e valia 10 dias.',
    default: '15',
    unit: 'dias',
    group: 'Prazos',
  },
} as const;

/** Aceita "0,25" e "0.25" — a tela de Parâmetros é digitada em pt-BR. */
export function parseDecimal(raw: string): number {
  const parsed = Number(String(raw).trim().replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : NaN;
}

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
      group: meta.group,
      value: byKey.get(key) ?? meta.default,
      isDefault: !byKey.has(key),
      default: meta.default,
    }));
  }

  /** Valor numérico de um parâmetro, com fallback para o default. */
  async number(key: SettingKey): Promise<number> {
    const stored = await this.prisma.systemSetting.findUnique({ where: { key } });
    const raw = stored?.value ?? SETTINGS[key].default;
    const parsed = parseDecimal(raw);
    return Number.isNaN(parsed) ? parseDecimal(SETTINGS[key].default) : parsed;
  }

  /**
   * Agravo do ramo — o desconto que a seguradora concede sobre o prêmio.
   *
   * Confirmado com o cliente em 03/11/2026: importação 0,25 %, exportação
   * 0,30 %. Um cliente pode ter agravo próprio negociado
   * (`Company.payableDiscountPercent`), que tem precedência sobre este —
   * é o caso da FRESNOMAQ, que no legado tinha um slot fixo "Importação Fresno".
   */
  async payableDiscountPercent(kind: 'IMPORT' | 'EXPORT'): Promise<number> {
    return this.number(
      kind === 'EXPORT'
        ? 'insurance.payable_discount_export_percent'
        : 'insurance.payable_discount_import_percent',
    );
  }

  /** Agravo efetivo: o do cliente quando houver, senão o do ramo. */
  async payableDiscountFor(
    kind: 'IMPORT' | 'EXPORT',
    clientDiscount: unknown,
  ): Promise<number> {
    if (clientDiscount !== null && clientDiscount !== undefined) {
      const own = Number(clientDiscount);
      if (Number.isFinite(own)) return own;
    }
    return this.payableDiscountPercent(kind);
  }

  async set(key: string, value: string, userId: string, ctx: RequestContext) {
    if (!(key in SETTINGS)) {
      throw new NotFoundException(`Parâmetro "${key}" não existe.`);
    }

    // Todo parâmetro de hoje é numérico. Guardar texto livre aqui quebraria o
    // cálculo silenciosamente, com fallback para o default sem avisar ninguém.
    const parsed = parseDecimal(value);
    if (Number.isNaN(parsed) || parsed < 0) {
      throw new BadRequestException('Informe um número válido, sem sinal negativo.');
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
