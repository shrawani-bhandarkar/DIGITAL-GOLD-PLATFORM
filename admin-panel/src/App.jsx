import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedLayout from './layouts/ProtectedLayout.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import { useAuth } from './context/AuthContext.jsx';
import CustomerManagementPage from './pages/CustomerManagementPage.jsx';
import CustomerDetailsPage from './pages/CustomerDetailsPage.jsx';
import MetalProductsPage from './pages/MetalProductsPage.jsx';
import RateManagementPage from './pages/RateManagementPage.jsx';
import { ManagementProvider } from './context/ManagementContext.jsx';
import { OperationsProvider } from './context/OperationsContext.jsx';
import OrdersPage from './pages/OrdersPage.jsx';
import OrderDetailsPage from './pages/OrderDetailsPage.jsx';
import SipManagementPage from './pages/SipManagementPage.jsx';
import RedemptionDeliveryPage from './pages/RedemptionDeliveryPage.jsx';
import GiftManagementPage from './pages/GiftManagementPage.jsx';
import PaymentsPage from './pages/PaymentsPage.jsx';
import RefundsPage from './pages/RefundsPage.jsx';
import ReconciliationPage from './pages/ReconciliationPage.jsx';
import ReportsPage from './pages/ReportsPage.jsx';
import RolesPermissionsPage from './pages/RolesPermissionsPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import AuditLogsPage from './pages/AuditLogsPage.jsx';
import { AdminProvider } from './context/AdminContext.jsx';

function App() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <main className="login-page" role="status">Checking your sign-in…</main>;
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route element={<ProtectedLayout />}>
        <Route element={<AdminProvider />}>
          <Route element={<ManagementProvider />}>
            <Route element={<OperationsProvider />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/customers" element={<CustomerManagementPage />} />
              <Route path="/customers/:customerId" element={<CustomerDetailsPage />} />
              <Route path="/products" element={<MetalProductsPage />} />
              <Route path="/rates" element={<RateManagementPage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/orders/:orderId" element={<OrderDetailsPage />} />
              <Route path="/sips" element={<SipManagementPage />} />
              <Route path="/redemptions" element={<RedemptionDeliveryPage />} />
              <Route path="/gifts" element={<GiftManagementPage />} />
              <Route path="/payments" element={<PaymentsPage />} />
              <Route path="/refunds" element={<RefundsPage />} />
              <Route path="/reconciliation" element={<ReconciliationPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/roles" element={<RolesPermissionsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/audit-logs" element={<AuditLogsPage />} />
            </Route>
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to={isAuthenticated ? '/' : '/login'} replace />} />
    </Routes>
  );
}

export default App;
