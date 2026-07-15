import { useEffect } from 'react';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import LorePage from './pages/LorePage';
import EnlistPage from './pages/EnlistPage';
import PersonnelPage from './pages/PersonnelPage';
import CommandPage from './pages/CommandPage';
import BattlesPage from './pages/BattlesPage';
import SchedulePage from './pages/SchedulePage';
import MedalsPage from './pages/MedalsPage';
import LoginPage from './pages/LoginPage';
import LinkRobloxPage from './pages/LinkRobloxPage';
import ApplyPage from './pages/ApplyPage';
import AdminPage from './pages/AdminPage';
import { getAuthenticatedState, resolveRouteForAuthState } from './lib/auth';
import { supabase } from './lib/supabase';

function AuthRouteGate() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    const handleRoute = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active) {
        return;
      }

      if (!session?.user) {
        if (location.pathname !== '/login') {
          navigate('/login', { replace: true });
        }
        return;
      }

      const { profile, rosterEntry } = await getAuthenticatedState();
      if (!active) {
        return;
      }

      const nextPath = resolveRouteForAuthState(profile, rosterEntry);
      if (location.pathname !== nextPath) {
        navigate(nextPath, { replace: true });
      }
    };

    void handleRoute();

    return () => {
      active = false;
    };
  }, [location.pathname, navigate]);

  return null;
}

function App() {
  return (
    <Layout>
      <AuthRouteGate />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/lore" element={<LorePage />} />
        <Route path="/enlist" element={<EnlistPage />} />
        <Route path="/enlist/apply" element={<ApplyPage />} />
        <Route path="/personnel" element={<PersonnelPage />} />
        <Route path="/command" element={<CommandPage />} />
        <Route path="/battles" element={<BattlesPage />} />
        <Route path="/schedule" element={<SchedulePage />} />
        <Route path="/medals" element={<MedalsPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/link-roblox" element={<LinkRobloxPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </Layout>
  );
}

export default App;
