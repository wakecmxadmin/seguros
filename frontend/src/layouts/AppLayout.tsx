import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  FileText,
  LogOut,
  Menu,
  CalendarCheck,
  History,
  Library,
  SlidersHorizontal,
  Receipt,
  Settings,
  ShieldCheck,
  Ship,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { Brand } from './AuthLayout';
import { useAuth } from '@/stores/auth';
import { cn, initials } from '@/lib/utils';

interface NavItem {
  label: string;
  to: string;
  icon: typeof Ship;
  /** Permissão necessária para o item aparecer. */
  permission?: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

/**
 * Navegação por módulo (docs/07-modulos.md). Só os itens já implementados
 * aparecem aqui — o menu cresce conforme os módulos entram.
 */
const NAV: NavGroup[] = [
  {
    title: 'Operação',
    items: [
      { label: 'Cotações', to: '/quotes', icon: Ship, permission: 'quote:list' },
      { label: 'Averbações', to: '/endorsements', icon: FileText, permission: 'endorsement:list' },
      {
        label: 'Fechamento mensal',
        to: '/endorsements/batches',
        icon: CalendarCheck,
        permission: 'endorsement:list',
      },
    ],
  },
  {
    title: 'Financeiro',
    items: [
      { label: 'Numerário', to: '/cash-requests', icon: Wallet, permission: 'cash_request:create' },
      { label: 'Comissões', to: '/commissions', icon: Receipt, permission: 'commission:list' },
    ],
  },
  {
    title: 'Administração',
    items: [
      { label: 'Cadastros', to: '/registrations', icon: Library, permission: 'catalog:list' },
      { label: 'Usuários', to: '/users', icon: Users, permission: 'user:list' },
      { label: 'Papéis e permissões', to: '/roles', icon: ShieldCheck, permission: 'role:list' },
      { label: 'Auditoria', to: '/audit', icon: History, permission: 'audit:list' },
      { label: 'Parâmetros', to: '/settings', icon: SlidersHorizontal, permission: 'quote:list' },
    ],
  },
];

export function AppLayout() {
  const { user, signOut, can } = useAuth();
  const navigate = useNavigate();
  const [navOpen, setNavOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const groups = NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => !i.permission || can(i.permission)),
  })).filter((g) => g.items.length > 0);

  async function handleSignOut() {
    await signOut();
    navigate('/sign-in', { replace: true });
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          // `sticky` + `h-screen` prende a sidebar à altura da janela: sem isso ela
          // acompanha a altura do conteúdo e "estica" em páginas longas.
          'fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-border bg-[#f7f7f7] transition-transform',
          'lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
          navOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="relative flex h-24 items-center justify-center border-b border-border px-5">
          <Link to="/" onClick={() => setNavOpen(false)}>
            <Brand large />
          </Link>
          <button
            onClick={() => setNavOpen(false)}
            className="absolute right-4 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded text-muted-foreground lg:hidden"
            aria-label="Fechar menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5">
          {groups.map((group) => (
            <div key={group.title} className="mb-6 last:mb-0">
              <p className="mb-2 px-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70">
                {group.title}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      onClick={() => setNavOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[14px] font-medium transition-colors',
                          isActive
                            ? 'bg-navy/8 text-navy'
                            : 'text-muted-foreground hover:bg-surface-alt hover:text-foreground',
                        )
                      }
                    >
                      <item.icon className="h-[17px] w-[17px] shrink-0" />
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Conta */}
        <div className="relative border-t border-border p-3">
          {accountOpen && (
            <div className="absolute bottom-full left-3 right-3 mb-2 overflow-hidden rounded-md border border-border bg-surface shadow-raised animate-slide-up">
              <Link
                to="/my-account"
                onClick={() => setAccountOpen(false)}
                className="flex items-center gap-2.5 px-3.5 py-2.5 text-[14px] text-foreground transition-colors hover:bg-surface-alt"
              >
                <Settings className="h-4 w-4 text-muted-foreground" />
                Minha conta
              </Link>
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-2.5 border-t border-border px-3.5 py-2.5 text-left text-[14px] text-danger transition-colors hover:bg-danger/6"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </button>
            </div>
          )}

          <button
            onClick={() => setAccountOpen((v) => !v)}
            className="flex w-full items-center gap-2.5 rounded-md p-2 text-left transition-colors hover:bg-surface-alt"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-navy text-[12px] font-semibold text-white">
              {initials(user?.name ?? '')}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-medium text-foreground">
                {user?.name}
              </span>
              <span className="block truncate text-[12px] text-muted-foreground">
                {user?.roles.map((r) => r.name).join(', ')}
              </span>
            </span>
            <ChevronDown
              className={cn(
                'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                accountOpen && 'rotate-180',
              )}
            />
          </button>
        </div>
      </aside>

      {navOpen && (
        <div
          className="fixed inset-0 z-30 bg-navy-deep/40 lg:hidden"
          onClick={() => setNavOpen(false)}
        />
      )}

      {/* Conteúdo */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center gap-3 border-b border-border bg-surface px-5 lg:hidden">
          <button
            onClick={() => setNavOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-surface-alt"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Brand chip />
        </header>

        <main className="flex-1 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
