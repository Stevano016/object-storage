import { Dashboard } from './Dashboard';
import { LoginPage } from './pages/LoginPage';
import { useAuth } from './context/AuthContext';

export default function App() {
  const { isAuthenticated } = useAuth();

  return isAuthenticated ? <Dashboard /> : <LoginPage />;
}
