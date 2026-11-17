import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AppLayout } from '@/layouts/AppLayout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/stores/auth';

import SignIn from '@/pages/SignIn';
import ForgotPassword from '@/pages/ForgotPassword';
import SetPassword from '@/pages/SetPassword';
import Home from '@/pages/Home';
import Registrations from '@/pages/Registrations';
import Users from '@/pages/Users';
import Roles from '@/pages/Roles';
import AuditLog from '@/pages/AuditLog';
import Parameters from '@/pages/Parameters';
import QuoteList from '@/features/quotes/QuoteList';
import QuoteForm from '@/features/quotes/QuoteForm';
import EndorsementList from '@/features/endorsements/EndorsementList';
import MonthlyBatches from '@/features/endorsements/MonthlyBatches';
import Settings from '@/pages/Settings';
import CashRequests from '@/features/finance/CashRequests';
import Commissions from '@/features/finance/Commissions';
import Reports from '@/features/reports/Reports';
import Alerts from '@/features/alerts/Alerts';
import EndorsementPrint from '@/features/documents/EndorsementPrint';
import EndorsementSelectionPrint from '@/features/documents/EndorsementSelectionPrint';
import MyAccount from '@/pages/MyAccount';
import Forbidden from '@/pages/Forbidden';
import NotFound from '@/pages/NotFound';
import GmailCallback from '@/pages/GmailCallback';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
  },
});

export default function App() {
  const loadSession = useAuth((s) => s.loadSession);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Público */}
          <Route path="/sign-in" element={<SignIn />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<SetPassword />} />
          <Route path="/first-access" element={<SetPassword />} />
          <Route path="/gmail/callback" element={<GmailCallback />} />

          {/* Autenticado */}
          <Route element={<ProtectedRoute />}>
            {/* Documentos para impressão: fora do layout, para sair limpo no papel. */}
            <Route element={<ProtectedRoute permission="document:generate" />}>
              <Route path="/print/endorsements/:id" element={<EndorsementPrint />} />
              <Route path="/print/endorsement-selection" element={<EndorsementSelectionPrint />} />
            </Route>

            <Route element={<AppLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/forbidden" element={<Forbidden />} />
              <Route path="/my-account" element={<MyAccount />} />

              {/* Configurações é só o ponto de entrada: cada tela abaixo dela tem
                  rota e permissão próprias. */}
              <Route path="/settings" element={<Settings />} />

              <Route element={<ProtectedRoute permission="user:list" />}>
                <Route path="/settings/users" element={<Users />} />
              </Route>

              <Route element={<ProtectedRoute permission="role:list" />}>
                <Route path="/settings/roles" element={<Roles />} />
              </Route>

              <Route element={<ProtectedRoute permission="quote:list" />}>
                <Route path="/settings/parameters" element={<Parameters />} />
              </Route>

              <Route element={<ProtectedRoute permission="audit:list" />}>
                <Route path="/settings/audit" element={<AuditLog />} />
              </Route>

              {/* Rotas antigas, de antes do agrupamento. */}
              <Route path="/users" element={<Navigate to="/settings/users" replace />} />
              <Route path="/roles" element={<Navigate to="/settings/roles" replace />} />
              <Route path="/audit" element={<Navigate to="/settings/audit" replace />} />

              <Route element={<ProtectedRoute permission="quote:list" />}>
                <Route path="/quotes" element={<QuoteList />} />
                <Route path="/quotes/new" element={<QuoteForm />} />
                <Route path="/quotes/:id" element={<QuoteForm />} />
              </Route>

              <Route element={<ProtectedRoute permission="endorsement:list" />}>
                <Route path="/endorsements" element={<EndorsementList />} />
                <Route path="/endorsements/batches" element={<MonthlyBatches />} />
              </Route>

              <Route element={<ProtectedRoute permission="cash_request:create" />}>
                <Route path="/cash-requests" element={<CashRequests />} />
              </Route>

              <Route element={<ProtectedRoute permission="commission:list" />}>
                <Route path="/commissions" element={<Commissions />} />
              </Route>

              <Route element={<ProtectedRoute anyPermission={['report:production', 'report:ranking']} />}>
                <Route path="/reports" element={<Reports />} />
              </Route>

              <Route element={<ProtectedRoute anyPermission={['quote:list', 'endorsement:list', 'policy:list']} />}>
                <Route path="/alerts" element={<Alerts />} />
              </Route>

              <Route element={<ProtectedRoute permission="catalog:list" />}>
                <Route path="/registrations/*" element={<Registrations />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              fontFamily: 'Inter, sans-serif',
              fontSize: '14px',
              borderRadius: '8px',
            },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
