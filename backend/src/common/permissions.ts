/**
 * Catálogo de permissões do sistema, no formato `resource:action`.
 * Fonte única para o seed do banco e para o decorator `@RequirePermissions()`.
 *
 * Os módulos seguem docs/07-modulos.md.
 */
export const PERMISSIONS = {
  auth: {
    'user:list': 'Listar usuários',
    'user:read': 'Ver detalhes de um usuário',
    'user:create': 'Criar usuário e enviar convite',
    'user:update': 'Editar dados de um usuário',
    'user:deactivate': 'Desativar ou reativar um usuário',
    'user:reset_password': 'Disparar redefinição de senha de outro usuário',
    'role:list': 'Listar papéis',
    'role:create': 'Criar papel',
    'role:update': 'Editar papel e suas permissões',
    'role:delete': 'Excluir papel',
    'audit:list': 'Consultar a trilha de auditoria',
  },
  partners: {
    'company:list': 'Consultar empresas (clientes, parceiros, seguradoras, transportadoras)',
    'company:update': 'Criar e editar empresas',
    'company:delete': 'Excluir empresa sem movimento',
    'employee:list': 'Listar funcionários',
    'employee:update': 'Criar e editar funcionários',
  },
  catalog: {
    'catalog:list': 'Consultar tabelas de domínio',
    'catalog:update': 'Editar tabelas de domínio',
    'catalog:delete': 'Excluir registros das tabelas de domínio',
  },
  policies: {
    'policy:list': 'Listar apólices',
    'policy:update': 'Criar e editar apólices',
    'coverage:list': 'Listar coberturas',
    'coverage:update': 'Criar e editar coberturas',
    'rate:update': 'Editar tabelas de taxas',
  },
  quotes: {
    'quote:list': 'Listar cotações',
    'quote:create': 'Criar cotação',
    'quote:update': 'Editar cotação',
    'quote:approve': 'Aprovar ou reprovar cotação',
    'quote:cancel': 'Cancelar cotação',
    'quote:override_rate': 'Sobrescrever manualmente a taxa calculada',
  },
  endorsements: {
    'endorsement:list': 'Listar averbações',
    'endorsement:issue_provisional': 'Emitir provisória',
    'endorsement:issue_final': 'Emitir definitiva',
    'endorsement:change_position': 'Alterar a posição de uma averbação',
    'endorsement:extend': 'Prorrogar uma definitiva',
  },
  documents: {
    'document:generate': 'Gerar proposta e certificado',
    'document:send': 'Enviar documentos por e-mail',
    'template:update': 'Gerenciar modelos de proposta',
  },
  finance: {
    'cash_request:create': 'Solicitar numerário',
    'cash_request:settle': 'Dar baixa em numerário',
    'commission:list': 'Consultar comissões',
    'commission:pay': 'Solicitar nota fiscal e pagar comissão',
    'reinsurance:issue': 'Emitir IRB',
  },
  fx: {
    'exchange_rate:list': 'Consultar taxas cambiais',
    'exchange_rate:update': 'Lançar ou sobrescrever taxa cambial',
  },
  reports: {
    'report:production': 'Acessar a planilha de produção',
    'report:ranking': 'Acessar rankings',
    'report:export': 'Exportar relatórios',
  },
  communications: {
    'message:list': 'Consultar mensagens e anexos de um processo',
    'message:send': 'Enviar mensagem por e-mail a partir de um processo',
    'gmail:connect': 'Conectar ou desconectar a própria conta Gmail',
  },
} as const;

export type PermissionSlug = {
  [M in keyof typeof PERMISSIONS]: keyof (typeof PERMISSIONS)[M];
}[keyof typeof PERMISSIONS];

/** Lista achatada, usada pelo seed. */
export function listPermissions() {
  return Object.entries(PERMISSIONS).flatMap(([module, items]) =>
    Object.entries(items).map(([slug, description]) => {
      const [resource, action] = slug.split(':');
      return { slug, resource, action, description, module };
    }),
  );
}
