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
import Users from '@/pages/Users';
import Roles from '@/pages/Roles';
import Registrations from '@/pages/Registrations';
import QuoteList from '@/features/quotes/QuoteList';
import QuoteForm from '@/features/quotes/QuoteForm';
import EndorsementList from '@/features/endorsements/EndorsementList';
import MonthlyBatches from '@/features/endorsements/MonthlyBatches';
import Settings from '@/pages/Settings';
import CashRequests from '@/features/finance/CashRequests';
import Commissions from '@/features/finance/Commissions';
import MyAccount from '@/pages/MyAccount';
import AuditLog from '@/pages/AuditLog';
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
            <Route element={<AppLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/forbidden" element={<Forbidden />} />
              <Route path="/my-account" element={<MyAccount />} />

              <Route element={<ProtectedRoute permission="quote:list" />}>
                <Route path="/settings" element={<Settings />} />
              </Route>

              <Route element={<ProtectedRoute permission="audit:list" />}>
                <Route path="/audit" element={<AuditLog />} />
              </Route>

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

              <Route element={<ProtectedRoute permission="catalog:list" />}>
                <Route path="/registrations/*" element={<Registrations />} />
              </Route>

              <Route element={<ProtectedRoute permission="user:list" />}>
                <Route path="/users" element={<Users />} />
              </Route>

              <Route element={<ProtectedRoute permission="role:list" />}>
                <Route path="/roles" element={<Roles />} />
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
