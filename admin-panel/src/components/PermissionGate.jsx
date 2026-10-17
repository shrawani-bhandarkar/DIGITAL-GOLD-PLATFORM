import { useAdmin } from '../context/AdminContext.jsx';

export const ROUTE_PERMISSIONS = {
  '/': 'dashboard',
  '/customers': 'customers',
  '/products': 'products',
  '/rates': 'products',
  '/orders': 'orders',
  '/sips': 'orders',
  '/redemptions': 'fulfillment',
  '/gifts': 'fulfillment',
  '/payments': 'finance',
  '/refunds': 'finance',
  '/reconciliation': 'finance',
  '/reports': 'reports',
  '/roles': 'administration',
  '/settings': 'administration',
  '/audit-logs': 'audit',
};

export default function PermissionGate({ permission, children }) {
  const { hasPermission, activeRole } = useAdmin();
  if (hasPermission(permission)) return children;
  return (
    <section className="panel access-denied-panel" role="alert">
      <h1>Access denied</h1>
      <p>The {activeRole?.name ?? 'current'} role does not have permission to access this page. Ask the Super Admin to update the role's assigned permissions.</p>
    </section>
  );
}
