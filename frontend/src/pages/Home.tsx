import { Navigate } from 'react-router-dom';
import { useAuth } from '@/stores/auth';

/**
 * A raiz não tem tela própria: leva a pessoa direto para o primeiro lugar onde ela
 * tem trabalho a fazer, na ordem em que os módulos importam para a operação.
 * (Sem dashboard genérico — ver CLAUDE.md.)
 */
const ENTRY_POINTS: Array<{ permission: string; to: string }> = [
  { permission: 'quote:list', to: '/quotes' },
  { permission: 'endorsement:list', to: '/endorsements' },
  { permission: 'cash_request:create', to: '/cash-requests' },
  { permission: 'commission:list', to: '/commissions' },
  { permission: 'catalog:list', to: '/registrations' },
  { permission: 'user:list', to: '/users' },
  { permission: 'role:list', to: '/roles' },
];

export default function Home() {
  const { can } = useAuth();
  const target = ENTRY_POINTS.find((e) => can(e.permission));
  return <Navigate to={target?.to ?? '/forbidden'} replace />;
}
