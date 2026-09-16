import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { Building2, FileCheck2, ShieldCheck, Coins } from 'lucide-react';
import { Page } from '@/components/ui/page';
import { CatalogCrud } from '@/features/catalog/CatalogCrud';
import { CATALOGS, CATALOG_GROUPS } from '@/features/catalog/config';
import Companies from '@/features/companies/Companies';
import Employees from '@/features/employees/Employees';
import Policies from '@/features/policies/Policies';
import Coverages from '@/features/policies/Coverages';
import ClientRates from '@/features/policies/ClientRates';
import ExchangeRates from '@/features/fx/ExchangeRates';
import { useAuth } from '@/stores/auth';
import { cn } from '@/lib/utils';

interface NavEntry {
  to: string;
  label: string;
  permission: string;
}

interface NavSection {
  title: string;
  icon?: typeof Building2;
  items: NavEntry[];
}

/**
 * Todos os cadastros num só lugar. No legado eram 20 itens soltos na sidebar,
 * em três padrões visuais diferentes — ver docs/05-cadastros.md.
 */
const SECTIONS: NavSection[] = [
  {
    title: 'Pessoas',
    icon: Building2,
    items: [
      { to: 'companies', label: 'Empresas', permission: 'company:list' },
      { to: 'employees', label: 'Funcionários', permission: 'employee:list' },
    ],
  },
  {
    title: 'Seguro',
    icon: ShieldCheck,
    items: [
      { to: 'policies', label: 'Apólices', permission: 'policy:list' },
      { to: 'coverages', label: 'Coberturas', permission: 'coverage:list' },
      { to: 'client-rates', label: 'Taxas por cliente', permission: 'policy:list' },
    ],
  },
  {
    title: 'Câmbio',
    icon: Coins,
    items: [{ to: 'exchange-rates', label: 'Cotações diárias', permission: 'exchange_rate:list' }],
  },
  ...CATALOG_GROUPS.map((group) => ({
    title: group.title,
    icon: FileCheck2,
    items: group.items.map((key) => ({
      to: key,
      label: CATALOGS[key].plural,
      permission: 'catalog:list',
    })),
  })),
];

export default function Registrations() {
  const { can } = useAuth();
  const location = useLocation();

  const sections = SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => can(item.permission)),
  })).filter((section) => section.items.length > 0);

  const first = sections[0]?.items[0];
  const isRoot = location.pathname.replace(/\/$/, '').endsWith('/registrations');

  if (isRoot && first) return <Navigate to={first.to} replace />;

  return (
    <Page
      title="Cadastros"
      description="Tabelas que alimentam as cotações: empresas, apólices, coberturas, câmbio e domínios."
    >
      <div className="grid gap-6 lg:grid-cols-[212px_1fr]">
        {/* Navegação interna */}
        <nav className="lg:sticky lg:top-8 lg:self-start">
          {sections.map((section) => (
            <div key={section.title} className="mb-5 last:mb-0">
              <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70">
                {section.title}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        cn(
                          'block rounded-md px-2.5 py-1.5 text-[13.5px] transition-colors',
                          isActive
                            ? 'bg-navy/8 font-medium text-navy'
                            : 'text-muted-foreground hover:bg-surface-alt hover:text-foreground',
                        )
                      }
                    >
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Conteúdo */}
        <div className="min-w-0">
          <Routes>
            <Route path="companies" element={<Companies />} />
            <Route path="employees" element={<Employees />} />
            <Route path="policies" element={<Policies />} />
            <Route path="coverages" element={<Coverages />} />
            <Route path="client-rates" element={<ClientRates />} />
            <Route path="exchange-rates" element={<ExchangeRates />} />
            {Object.values(CATALOGS).map((config) => (
              <Route
                key={config.key}
                path={config.key}
                element={<CatalogCrud config={config} />}
              />
            ))}
            <Route path="*" element={first ? <Navigate to={first.to} replace /> : null} />
          </Routes>
        </div>
      </div>
    </Page>
  );
}
