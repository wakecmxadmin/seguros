import { AlertsService } from './alerts.service';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

const DAY = 24 * 60 * 60 * 1000;
const today = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};
const daysFromToday = (n: number) => new Date(today().getTime() + n * DAY);

function service(endorsements: Array<{ id: string; berthingDate: Date }>) {
  const prisma = {
    endorsement: {
      findMany: jest.fn(async (args: any) =>
        // A consulta de prazos filtra por atracação; as demais voltam vazias.
        args.where.berthingDate
          ? endorsements
              .filter((e) => e.berthingDate < args.where.berthingDate.lt)
              .map((e) => ({
                ...e,
                number: `D-${e.id}`,
                type: 'FINAL',
                quote: { number: 1, client: { legalName: 'Cliente', tradeName: null } },
              }))
          : [],
      ),
      count: jest.fn(async () => 0),
    },
    quote: { findMany: jest.fn(async () => []), count: jest.fn(async () => 0) },
    policy: { findMany: jest.fn(async () => []), count: jest.fn(async () => 0) },
  };
  const values: Record<string, number> = {
    'deadline.tfa_days': 15,
    'deadline.endorsement_days': 15,
    'alerts.deadline_warning_days': 3,
    'alerts.provisional_without_final_days': 30,
    'alerts.stale_quote_days': 7,
    'alerts.policy_expiry_days': 30,
  };
  const settings = { number: jest.fn(async (key: string) => values[key]) };
  return new AlertsService(prisma as any, settings as any);
}

const user = (permissions: string[], extra: Partial<AuthenticatedUser> = {}) =>
  ({ id: 'u', permissions, clientId: null, partnerId: null, ...extra }) as AuthenticatedUser;

describe('AlertsService', () => {
  it('prazos: inclui vencidos e os que vencem dentro do aviso, nada além', async () => {
    const result = await service([
      { id: 'vencido', berthingDate: daysFromToday(-20) }, // venceu há 5 dias
      { id: 'hoje', berthingDate: daysFromToday(-15) }, // vence hoje
      { id: 'em3', berthingDate: daysFromToday(-12) }, // vence em 3 dias
      { id: 'em4', berthingDate: daysFromToday(-11) }, // fora do aviso
    ]).list(user(['endorsement:list']));

    const deadlines = result.groups.find((g) => g.key === 'deadlines')!;
    expect(deadlines.items.map((i) => i.target.id)).toEqual(['vencido', 'hoje', 'em3']);
    expect(deadlines.items.map((i) => i.overdue)).toEqual([true, false, false]);
  });

  it('mostra só os grupos que a permissão permite', async () => {
    const result = await service([]).list(user(['quote:list']));
    expect(result.groups.map((g) => g.key)).toEqual(['quotes']);
  });

  it('apólices não aparecem para usuário de cliente', async () => {
    const result = await service([]).list(user(['policy:list'], { clientId: 'c1' }));
    expect(result.groups).toEqual([]);
  });
});
