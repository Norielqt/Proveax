import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import InviteAccept from './pages/InviteAccept';
import Dashboard from './pages/Dashboard';
import PropertyDetail from './pages/PropertyDetail';
import Subscription from './pages/Subscription';
import AdminActivity from './pages/AdminActivity';
import GoogleOnboarding from './pages/GoogleOnboarding';
import GoogleCallback from './pages/GoogleCallback';
import CRM from './pages/CRM';
import MySession from './pages/MySession';
import Settings from './pages/Settings';
import OnboardingPlan from './pages/OnboardingPlan';
import AppShell from './components/layout/AppShell';
import LoadingScreen from './components/layout/LoadingScreen';
import ConsentGate from './components/team/ConsentGate';

import TeamLayout from './pages/team/TeamLayout';
import TeamOverview from './pages/team/Overview';
import TeamMembers from './pages/team/Members';
import TeamTimesheets from './pages/team/Timesheets';
import TeamActivity from './pages/team/Activity';
import TeamScreenshots from './pages/team/Screenshots';
import TeamApiUsage from './pages/team/ApiUsage';
import TeamSettings from './pages/team/Settings';

function RequireAuth() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <ConsentGate>
      <Outlet />
    </ConsentGate>
  );
}

// Block admins who haven't picked a plan / saved a card yet from the rest of
// the app. Non-admins (invited employees) are never gated. The onboarding
// page itself renders OUTSIDE this gate.
function RequireBillingOnboarded() {
  const { user, tenant } = useAuth();
  const isAdmin = user?.role === 'admin';
  // Onboarding is only complete once a real Stripe subscription is attached.
  // This catches both fresh signups AND legacy tenants stuck in "trialing"
  // without a Stripe sub (older Google signups), forcing them to pick a plan
  // and add a card before getting access.
  const needsOnboarding = isAdmin && tenant && !tenant.stripe_subscription_id;
  if (needsOnboarding) return <Navigate to="/onboarding/plan" replace />;
  return <Outlet />;
}

function RequireAdmin() {
  const { user } = useAuth();
  return user?.role === 'admin' ? <Outlet /> : <Navigate to="/search" replace />;
}

export default function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/invite/:token" element={<InviteAccept />} />
        <Route path="/google/onboarding" element={<GoogleOnboarding />} />
        <Route path="/auth/google/callback" element={<GoogleCallback />} />

        <Route element={<RequireAuth />}>
          {/* Onboarding stands alone — no AppShell, no billing gate */}
          <Route path="/onboarding/plan" element={<OnboardingPlan />} />

          <Route element={<RequireBillingOnboarded />}>
            <Route element={<AppShell />}>
            <Route path="/search" element={<Dashboard />} />
            <Route path="/dashboard" element={<Navigate to="/search" replace />} />
            <Route path="/properties/:id" element={<PropertyDetail />} />
            <Route path="/subscription" element={<Subscription />} />
            <Route path="/crm" element={<CRM />} />
            <Route path="/me/session" element={<MySession />} />
            <Route path="/settings" element={<Settings />} />

            {/* Admin team routes */}
            <Route element={<RequireAdmin />}>
              <Route path="/admin/team" element={<TeamLayout base="/admin/team" />}>
                <Route index element={<TeamOverview />} />
                <Route path="members" element={<TeamMembers />} />
                <Route path="timesheets" element={<TeamTimesheets />} />
                <Route path="activity" element={<TeamActivity />} />
                <Route path="screenshots" element={<TeamScreenshots />} />
                <Route path="api-usage" element={<TeamApiUsage />} />
                <Route path="settings" element={<TeamSettings />} />
              </Route>
              <Route path="/admin/activity" element={<Navigate to="/admin/team/activity" replace />} />
            </Route>

            {/* Employee team routes */}
            <Route path="/team" element={<TeamLayout base="/team" />}>
              <Route index element={<Navigate to="members" replace />} />
              <Route path="members" element={<TeamMembers />} />
              <Route path="timesheets" element={<TeamTimesheets />} />
              <Route path="screenshots" element={<TeamScreenshots />} />
              <Route path="*" element={<Navigate to="/team/members" replace />} />
            </Route>
          </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
