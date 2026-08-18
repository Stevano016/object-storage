import { Dashboard } from './Dashboard';
import { LoginPage } from './pages/LoginPage';
import { SharePage } from './pages/SharePage';
import { useAuth } from './context/AuthContext';

const SHARE_PREFIX = '/share/';

export default function App() {
  const { isAuthenticated } = useAuth();
  const path = window.location.pathname;

  // Share links are public: they render without a session, and they must not be
  // swallowed by the dashboard when an admin happens to be logged in.
  if (path.startsWith(SHARE_PREFIX)) {
    const token = decodeURIComponent(path.slice(SHARE_PREFIX.length).split('/')[0]);
    if (token) return <SharePage token={token} />;
  }

  return isAuthenticated ? <Dashboard /> : <LoginPage />;
}
