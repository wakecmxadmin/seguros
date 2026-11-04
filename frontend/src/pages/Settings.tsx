import { Link, Navigate } from 'react-router-dom';
import { ChevronRight, History, ShieldCheck, SlidersHorizontal, Users } from 'lucide-react';
import { Page } from '@/components/ui/page';
import { useAuth } from '@/stores/auth';

interface SettingsCard {
  to: string;
  label: string;
  description: string;
  icon: typeof Users;
  permission: string;
}

/**
 * Ponto de entrada da Administração: em vez de cinco itens soltos na sidebar,
 * um lugar só de onde se chega a cada tela de configuração.
 */
const CARDS: SettingsCard[] = [
  {
    to: '/settings/users',
    label: 'Usuários',
    description: 'Quem acessa o sistema, com quais papéis, e convites de primeiro acesso.',
    icon: Users,
    permission: 'user:list',
  },
  {
    to: '/settings/roles',
    label: 'Papéis e permissões',
    description: 'Um papel agrupa permissões. Cada usuário recebe um ou mais papéis.',
    icon: ShieldCheck,
    permission: 'role:list',
  },
  {
    to: '/settings/parameters',
    label: 'Parâmetros',
    description: 'Valores de negócio que o cálculo usa: agravo, financeiro e prazos.',
    icon: SlidersHorizontal,
    permission: 'quote:list',
  },
  {
    to: '/settings/audit',
    label: 'Auditoria',
    description: 'Quem fez o quê e quando, com o antes e o depois de cada alteração.',
    icon: History,
    permission: 'audit:list',
  },
];

export default function Settings() {
  const { can } = useAuth();
  const cards = CARDS.filter((card) => can(card.permission));

  // A tela não tem conteúdo próprio: sem nenhum card não há o que mostrar.
  if (cards.length === 0) return <Navigate to="/forbidden" replace />;

  return (
    <Page
      title="Configurações"
      description="Acesso das pessoas, parâmetros de cálculo e histórico de alterações."
    >
      <div className="grid max-w-4xl gap-3 sm:grid-cols-2">
        {cards.map((card) => (
          <Link
            key={card.to}
            to={card.to}
            className="group flex items-start gap-3.5 rounded-lg border border-border bg-surface p-4 shadow-card transition-colors hover:border-navy/30 hover:bg-surface-alt/50"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-navy/8 text-navy">
              <card.icon className="h-[18px] w-[18px]" />
            </span>

            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium text-foreground">{card.label}</span>
              <span className="mt-1 block text-[13px] leading-relaxed text-muted-foreground">
                {card.description}
              </span>
            </span>

            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-navy" />
          </Link>
        ))}
      </div>
    </Page>
  );
}
