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
import PermissionGate, { ROUTE_PERMISSIONS } from './components/PermissionGate.jsx';

function permittedPage(path, element) {
  return <PermissionGate permission={ROUTE_PERMISSIONS[path]}>{element}</PermissionGate>;
}

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
      <Route element={<AdminProvider />}>
        <Route element={<ProtectedLayout />}>
          <Route element={<ManagementProvider />}>
            <Route element={<OperationsProvider />}>
              <Route path="/" element={permittedPage('/', <DashboardPage />)} />
              <Route path="/customers" element={permittedPage('/customers', <CustomerManagementPage />)} />
              <Route path="/customers/:customerId" element={permittedPage('/customers', <CustomerDetailsPage />)} />
              <Route path="/products" element={permittedPage('/products', <MetalProductsPage />)} />
              <Route path="/rates" element={permittedPage('/rates', <RateManagementPage />)} />
              <Route path="/orders" element={permittedPage('/orders', <OrdersPage />)} />
              <Route path="/orders/:orderId" element={permittedPage('/orders', <OrderDetailsPage />)} />
              <Route path="/sips" element={permittedPage('/sips', <SipManagementPage />)} />
              <Route path="/redemptions" element={permittedPage('/redemptions', <RedemptionDeliveryPage />)} />
              <Route path="/gifts" element={permittedPage('/gifts', <GiftManagementPage />)} />
              <Route path="/payments" element={permittedPage('/payments', <PaymentsPage />)} />
              <Route path="/refunds" element={permittedPage('/refunds', <RefundsPage />)} />
              <Route path="/reconciliation" element={permittedPage('/reconciliation', <ReconciliationPage />)} />
              <Route path="/reports" element={permittedPage('/reports', <ReportsPage />)} />
              <Route path="/roles" element={permittedPage('/roles', <RolesPermissionsPage />)} />
              <Route path="/settings" element={permittedPage('/settings', <SettingsPage />)} />
              <Route path="/audit-logs" element={permittedPage('/audit-logs', <AuditLogsPage />)} />
            </Route>
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to={isAuthenticated ? '/' : '/login'} replace />} />
    </Routes>
  );
}

export default App;
