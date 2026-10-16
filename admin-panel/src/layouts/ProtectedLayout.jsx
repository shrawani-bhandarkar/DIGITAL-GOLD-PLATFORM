import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import AdminLayout from './AdminLayout.jsx';

export default function ProtectedLayout() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <AdminLayout /> : <Navigate to="/login" replace />;
}
