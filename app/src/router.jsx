import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import InviteAccept from './pages/InviteAccept';
import Dashboard from './pages/Dashboard';
import PropertyDetail from './pages/PropertyDetail';
import Billing from './pages/Billing';
import AdminEmployees from './pages/AdminEmployees';
import AdminActivity from './pages/AdminActivity';
import AppShell from './components/layout/AppShell';

function RequireAuth() {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-10">Loading…</div>;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
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

        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route path="/search" element={<Dashboard />} />
            <Route path="/dashboard" element={<Navigate to="/search" replace />} />
            <Route path="/properties/:id" element={<PropertyDetail />} />
            <Route path="/billing" element={<Billing />} />

            <Route element={<RequireAdmin />}>
              <Route path="/admin/employees" element={<AdminEmployees />} />
              <Route path="/admin/activity" element={<AdminActivity />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
