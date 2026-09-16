import { PrismaClient, UserStatus, UserType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { listPermissions, PERMISSIONS } from '../src/common/permissions';

const prisma = new PrismaClient();

/**
 * Papéis derivados dos setores observados no legado (Seguro, Sinistro, Financeiro,
 * Administrativo) e dos perfis de acesso previstos em docs/07-modulos.md.
 * `name` e `description` ficam em português por serem exibidos na interface.
 */
const ROLES: Array<{
  slug: string;
  name: string;
  description: string;
  permissions: string[] | '*';
}> = [
  {
    slug: 'admin',
    name: 'Administrador',
    description: 'Acesso irrestrito, incluindo usuários, papéis e auditoria.',
    permissions: '*',
  },
  {
    slug: 'insurance_operator',
    name: 'Operador de Seguros',
    description: 'Cota, aprova e emite averbações. O dia a dia da operação.',
    permissions: [
      ...Object.keys(PERMISSIONS.quotes),
      ...Object.keys(PERMISSIONS.endorsements),
      ...Object.keys(PERMISSIONS.documents),
      ...Object.keys(PERMISSIONS.communications),
      'company:list', 'company:update',
      'employee:list',
      'catalog:list',
      'policy:list', 'coverage:list',
      'exchange_rate:list',
      'report:production', 'report:ranking', 'report:export',
    ],
  },
  {
    slug: 'finance',
    name: 'Financeiro',
    description: 'Numerário, comissões, IRB e câmbio.',
    permissions: [
      ...Object.keys(PERMISSIONS.finance),
      ...Object.keys(PERMISSIONS.fx),
      'quote:list',
      'endorsement:list',
      'company:list',
      'report:production', 'report:ranking', 'report:export',
    ],
  },
  {
    slug: 'sales',
    name: 'Comercial',
    description: 'Cria cotações e acompanha a carteira, sem aprovar nem emitir.',
    permissions: [
      'quote:list', 'quote:create', 'quote:update',
      'endorsement:list',
      'company:list', 'company:update',
      'policy:list', 'coverage:list',
      'catalog:list', 'exchange_rate:list',
      'document:generate',
      'message:list', 'message:send', 'gmail:connect',
      'report:ranking',
    ],
  },
  {
    slug: 'viewer',
    name: 'Consulta',
    description: 'Somente leitura. Útil para auditoria interna e apoio.',
    permissions: [
      'quote:list', 'endorsement:list', 'commission:list',
      'company:list', 'employee:list',
      'policy:list', 'coverage:list',
      'catalog:list', 'exchange_rate:list',
      'message:list',
      'report:production', 'report:ranking',
    ],
  },
];

async function main() {
  console.log('→ Sincronizando permissões…');
  const permissions = listPermissions();
  for (const p of permissions) {
    await prisma.permission.upsert({
      where: { slug: p.slug },
      update: { resource: p.resource, action: p.action, description: p.description, module: p.module },
      create: p,
    });
  }
  // Remove permissões que saíram do catálogo (ex.: client/partner/insurer, que viraram company).
  const orphans = await prisma.permission.findMany({
    where: { slug: { notIn: permissions.map((p) => p.slug) } },
    select: { id: true, slug: true },
  });
  if (orphans.length) {
    await prisma.permission.deleteMany({ where: { id: { in: orphans.map((o) => o.id) } } });
    console.log(`  ${orphans.length} obsoletas removidas: ${orphans.map((o) => o.slug).join(', ')}`);
  }
  console.log(`  ${permissions.length} permissões`);

  console.log('→ Sincronizando papéis…');
  const all = await prisma.permission.findMany({ select: { id: true, slug: true } });
  const idBySlug = new Map(all.map((p) => [p.slug, p.id]));

  for (const role of ROLES) {
    const slugs = role.permissions === '*' ? all.map((p) => p.slug) : role.permissions;
    const ids = slugs.map((s) => {
      const id = idBySlug.get(s);
      if (!id) throw new Error(`Permissão desconhecida no seed: ${s}`);
      return id;
    });

    const record = await prisma.role.upsert({
      where: { slug: role.slug },
      update: { name: role.name, description: role.description, system: true },
      create: { slug: role.slug, name: role.name, description: role.description, system: true },
    });

    // Reaplica o conjunto de permissões do papel de sistema.
    await prisma.rolePermission.deleteMany({ where: { roleId: record.id } });
    await prisma.rolePermission.createMany({
      data: ids.map((permissionId) => ({ roleId: record.id, permissionId })),
      skipDuplicates: true,
    });

    console.log(`  ${role.name.padEnd(22)} ${ids.length} permissões`);
  }

  // --- Administrador inicial -------------------------------------------------
  const email = (process.env.ADMIN_EMAIL ?? 'admin@wakecomex.com').toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`→ Administrador já existe (${email}), nada a fazer.`);
  } else {
    const adminRole = await prisma.role.findUniqueOrThrow({ where: { slug: 'admin' } });
    const user = await prisma.user.create({
      data: {
        name: process.env.ADMIN_NAME ?? 'Administrador',
        email,
        type: UserType.INTERNAL,
        // Sem senha no .env, o admin nasce INVITED e define a senha pelo fluxo normal.
        password: password ? await bcrypt.hash(password, 12) : null,
        status: password ? UserStatus.ACTIVE : UserStatus.INVITED,
        roles: { create: { roleId: adminRole.id } },
      },
    });
    console.log(`→ Administrador criado: ${user.email} (${user.status})`);
    if (!password) {
      console.log('  Defina ADMIN_PASSWORD no .env e rode de novo, ou use "esqueci minha senha".');
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
