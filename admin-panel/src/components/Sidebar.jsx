import { Coins, LayoutDashboard, LogOut, ShieldCheck, X, Users, Gem, TrendingUp, ArrowLeftRight, CalendarClock, PackageCheck, Gift, CreditCard, RotateCcw, Scale, FileBarChart, KeyRound, Settings, ScrollText } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useAdmin } from '../context/AdminContext.jsx';
import { ROUTE_PERMISSIONS } from './PermissionGate.jsx';

export default function Sidebar({ isOpen, onClose }) {
  const { logout } = useAuth();
  const { hasPermission } = useAdmin();
  const canVisit = (path) => hasPermission(ROUTE_PERMISSIONS[path]);

  return (
    <aside id="main-navigation" className={`sidebar ${isOpen ? 'sidebar-open' : ''}`} aria-label="Main navigation">
      <div className="sidebar-brand">
        <span className="brand-mark"><Coins size={21} strokeWidth={2.2} /></span>
        <span className="brand-name">aurum<span>admin</span></span>
        <button className="icon-button sidebar-close" onClick={onClose} aria-label="Close menu">
          <X size={19} />
        </button>
      </div>

      <div className="workspace-switcher">
        <div className="workspace-avatar">DG</div>
        <div className="workspace-copy">
          <strong>Digital Gold</strong>
          <span>Platform workspace</span>
        </div>
        <span className="workspace-indicator" aria-label="Workspace active" />
      </div>

      <div className="nav-section-label">WORKSPACE</div>
      <nav className="sidebar-nav">
        {canVisit('/') && <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={onClose}>
          <LayoutDashboard size={18} />
          <span>Dashboard</span>
          <span className="nav-link-current">Overview</span>
        </NavLink>}
        {canVisit('/customers') && <NavLink to="/customers" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={onClose}>
          <Users size={18} /><span>Customers</span>
        </NavLink>}
        {canVisit('/products') && <NavLink to="/products" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={onClose}>
          <Gem size={18} /><span>Metal products</span>
        </NavLink>}
        {canVisit('/rates') && <NavLink to="/rates" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={onClose}>
          <TrendingUp size={18} /><span>Rate management</span>
        </NavLink>}
        {canVisit('/orders') && <NavLink to="/orders" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={onClose}>
          <ArrowLeftRight size={18} /><span>Buy &amp; sell orders</span>
        </NavLink>}
        {canVisit('/sips') && <NavLink to="/sips" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={onClose}>
          <CalendarClock size={18} /><span>SIP management</span>
        </NavLink>}
        {canVisit('/redemptions') && <NavLink to="/redemptions" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={onClose}>
          <PackageCheck size={18} /><span>Redemption &amp; delivery</span>
        </NavLink>}
        {canVisit('/gifts') && <NavLink to="/gifts" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={onClose}>
          <Gift size={18} /><span>Gift management</span>
        </NavLink>}
        {['finance'].some(hasPermission) && <div className="nav-section-label nav-section-sub">FINANCE</div>}
        {canVisit('/payments') && <NavLink to="/payments" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={onClose}>
          <CreditCard size={18} /><span>Payments</span>
        </NavLink>}
        {canVisit('/refunds') && <NavLink to="/refunds" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={onClose}>
          <RotateCcw size={18} /><span>Refunds</span>
        </NavLink>}
        {canVisit('/reconciliation') && <NavLink to="/reconciliation" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={onClose}>
          <Scale size={18} /><span>Reconciliation</span>
        </NavLink>}
        {canVisit('/reports') && <NavLink to="/reports" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={onClose}>
          <FileBarChart size={18} /><span>Reports &amp; exports</span>
        </NavLink>}
        {['administration', 'audit'].some(hasPermission) && <div className="nav-section-label nav-section-sub">ADMINISTRATION</div>}
        {canVisit('/roles') && <NavLink to="/roles" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={onClose}>
          <KeyRound size={18} /><span>Roles &amp; permissions</span>
        </NavLink>}
        {canVisit('/settings') && <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={onClose}>
          <Settings size={18} /><span>Settings</span>
        </NavLink>}
        {canVisit('/audit-logs') && <NavLink to="/audit-logs" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={onClose}>
          <ScrollText size={18} /><span>Audit logs</span>
        </NavLink>}
      </nav>

      <div className="sidebar-bottom">
        <div className="security-note">
          <ShieldCheck size={17} />
          <div><strong>Demo environment</strong><span>Sample data only</span></div>
        </div>
        <button className="sidebar-logout" onClick={logout}>
          <LogOut size={17} /><span>Sign out</span>
        </button>
        <div className="sidebar-version">ADMIN CONSOLE <span>v0.1.0</span></div>
      </div>
    </aside>
  );
}
