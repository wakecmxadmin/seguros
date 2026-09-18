import { PrismaClient } from '@prisma/client';
import { listPermissions } from '../src/common/permissions';

const prisma = new PrismaClient();

/**
 * Concede `sigra:read` sem reaplicar o `seed` inteiro — o seed completo apaga e
 * recria TODAS as permissões dos papéis de sistema a partir do código, o que
 * derrubaria qualquer ajuste feito manualmente na tela de Papéis (o papel de
 * sistema pode ter as permissões editadas por lá, ver `roles.service.ts`).
 * Este script só faz um INSERT idempotente do que falta — nunca remove nada.
 */
const ROLE_SLUGS = ['admin', 'insurance_operator', 'finance', 'sales'];

async function main() {
  const slug = 'sigra:read';
  const catalogEntry = listPermissions().find((p) => p.slug === slug);
  if (!catalogEntry) throw new Error(`"${slug}" não está em src/common/permissions.ts.`);

  const permission = await prisma.permission.upsert({
    where: { slug },
    update: {
      resource: catalogEntry.resource,
      action: catalogEntry.action,
      description: catalogEntry.description,
      module: catalogEntry.module,
    },
    create: catalogEntry,
  });
  console.log(`✓ Permissão "${slug}" (${permission.id}) sincronizada.`);

  const roles = await prisma.role.findMany({ where: { slug: { in: ROLE_SLUGS } } });
  const found = new Set(roles.map((r) => r.slug));
  for (const missing of ROLE_SLUGS.filter((s) => !found.has(s))) {
    console.warn(`  ⚠ Papel "${missing}" não existe no banco — ignorado.`);
  }

  for (const role of roles) {
    const existing = await prisma.rolePermission.findUnique({
      where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
    });
    if (existing) {
      console.log(`  = ${role.name}: já tinha.`);
      continue;
    }
    await prisma.rolePermission.create({
      data: { roleId: role.id, permissionId: permission.id },
    });
    console.log(`  + ${role.name}: concedida.`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
