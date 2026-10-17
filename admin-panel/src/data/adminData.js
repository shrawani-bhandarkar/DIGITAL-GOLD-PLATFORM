export const DEFAULT_SETTINGS = {
  organizationName: 'Digital Gold Platform',
  supportEmail: 'support@digitalgold.demo',
  timezone: 'Asia/Kolkata',
  dateFormat: 'DD MMM YYYY',
  sessionTimeout: 30,
  loginAlerts: true,
  weeklyReport: false,
  maintenanceMode: false,
};

export const PERMISSION_GROUPS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'customers', label: 'Customers' },
  { key: 'products', label: 'Products & rates' },
  { key: 'orders', label: 'Orders & SIPs' },
  { key: 'fulfillment', label: 'Redemption & gifts' },
  { key: 'finance', label: 'Payments & refunds' },
  { key: 'reports', label: 'Reports & exports' },
  { key: 'administration', label: 'Roles & settings' },
  { key: 'audit', label: 'Audit logs' },
];

export const DEFAULT_ROLES = [
  { id: 'SUPER_ADMIN', name: 'Super Admin', description: 'Shop owner · full administrative access', users: 1, locked: true, permissions: Object.fromEntries(PERMISSION_GROUPS.map(({ key }) => [key, true])) },
  { id: 'ADMIN', name: 'Admin', description: 'Operational access assigned by the Super Admin', users: 1, locked: false, permissions: { dashboard: true, customers: true, products: false, orders: true, fulfillment: true, finance: false, reports: false, administration: false, audit: false } },
];

export const INITIAL_AUDIT_EVENTS = [
  { id: 'AUD-2026-00128', timestamp: '2026-10-15T10:42:18+05:30', actor: 'Super Admin', action: 'Viewed payment record', category: 'Payments', target: 'PAY-2026-09281', detail: 'Opened read-only payment details.', outcome: 'Viewed' },
  { id: 'AUD-2026-00127', timestamp: '2026-10-15T10:15:00+05:30', actor: 'Super Admin', action: 'Approved rate request', category: 'Rates', target: 'RATE-2026-018', detail: 'Approved a demo rate change.', outcome: 'Simulated' },
  { id: 'AUD-2026-00126', timestamp: '2026-10-15T09:58:12+05:30', actor: 'Admin', action: 'Reviewed KYC profile', category: 'Customers', target: 'CUS-10482', detail: 'Customer verification review recorded.', outcome: 'Simulated' },
  { id: 'AUD-2026-00125', timestamp: '2026-10-14T16:41:29+05:30', actor: 'Admin', action: 'Reviewed refund request', category: 'Refunds', target: 'REF-2026-00317', detail: 'Request decision logged in demo state.', outcome: 'Simulated' },
  { id: 'AUD-2026-00124', timestamp: '2026-10-14T14:20:00+05:30', actor: 'Super Admin', action: 'Marked settlement for review', category: 'Reconciliation', target: 'STL-2026-01015-B', detail: 'Sample mismatch flagged for offline review.', outcome: 'Simulated' },
  { id: 'AUD-2026-00123', timestamp: '2026-10-14T11:04:45+05:30', actor: 'Super Admin', action: 'Exported report', category: 'Reports', target: 'digital-gold-payments.csv', detail: 'Filtered sample CSV downloaded locally.', outcome: 'Completed' },
  { id: 'AUD-2026-00122', timestamp: '2026-10-13T17:36:00+05:30', actor: 'Admin', action: 'Updated metal product', category: 'Products', target: 'MET-002', detail: 'Sample product catalog entry edited.', outcome: 'Simulated' },
];
