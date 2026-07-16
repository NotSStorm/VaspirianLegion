import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import LorePage from './pages/LorePage';
import EnlistPage from './pages/EnlistPage';
import PersonnelPage from './pages/PersonnelPage';
import CommandPage from './pages/CommandPage';
import BattlesPage from './pages/BattlesPage';
import SchedulePage from './pages/SchedulePage';
import MedalsPage from './pages/MedalsPage';
import LeaderboardPage from './pages/LeaderboardPage';
import RallyTrackerPage from './pages/RallyTrackerPage';
import LoginPage from './pages/LoginPage';
import LinkRobloxPage from './pages/LinkRobloxPage';
import ApplyPage from './pages/ApplyPage';
import AdminPage from './pages/AdminPage';
import ProfilePage from './pages/ProfilePage';
import { getAuthenticatedState } from './lib/auth';
import { supabase } from './lib/supabase';

type RouteAccessState = {
  loading: boolean;
  hasSession: boolean;
  role: 'member' | 'officer' | 'admin' | null;
  robloxUsername: string | null;
};

function ProtectedRoute({ children, requireRoblox = false, requireStaff = false }: { children: ReactNode; requireRoblox?: boolean; requireStaff?: boolean }) {
  const location = useLocation();
  const [accessState, setAccessState] = useState<RouteAccessState>({
    loading: true,
    hasSession: false,
    role: null,
    robloxUsername: null
  });

  useEffect(() => {
    let active = true;

    const resolveAccessState = async () => {
      const { session, profile } = await getAuthenticatedState();
      if (!active) {
        return;
      }

      setAccessState({
        loading: false,
        hasSession: Boolean(session?.user),
        role: profile?.role ?? null,
        robloxUsername: profile?.roblox_username?.trim() || null
      });
    };

    void resolveAccessState();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      void resolveAccessState();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  if (accessState.loading) {
    return null;
  }

  if (!accessState.hasSession) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (requireRoblox && location.pathname !== '/link-roblox' && !accessState.robloxUsername) {
    return <Navigate to="/link-roblox" replace />;
  }

  if (requireStaff && accessState.role !== 'admin' && accessState.role !== 'officer') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/lore" element={<LorePage />} />
        <Route path="/enlist" element={<EnlistPage />} />
        <Route
          path="/enlist/apply"
          element={(
            <ProtectedRoute requireRoblox>
              <ApplyPage />
            </ProtectedRoute>
          )}
        />
        <Route path="/personnel" element={<PersonnelPage />} />
        <Route path="/command" element={<CommandPage />} />
        <Route path="/battles" element={<BattlesPage />} />
        <Route path="/schedule" element={<SchedulePage />} />
        <Route path="/medals" element={<MedalsPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/rally-tracker" element={<RallyTrackerPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/link-roblox"
          element={(
            <ProtectedRoute>
              <LinkRobloxPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/admin"
          element={(
            <ProtectedRoute requireRoblox requireStaff>
              <AdminPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/profile"
          element={(
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          )}
        />
      </Routes>
    </Layout>
  );
}

export default App;
