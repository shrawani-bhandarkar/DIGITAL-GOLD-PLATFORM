import { Bell, ChevronDown, Menu, Search, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useAdmin } from '../context/AdminContext.jsx';

export default function Topbar({ isMenuOpen = false, onMenuClick, onSearchChange }) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { logout, user } = useAuth();
  const { activeRole, activeRoleId } = useAdmin();
  const { pathname } = useLocation();
  const currentPage = pathname.startsWith('/customers/')
    ? 'Customer details'
    : pathname.startsWith('/orders/')
      ? 'Order details'
      : ({
        '/customers': 'Customers',
        '/products': 'Metal products',
        '/rates': 'Rate management',
        '/orders': 'Buy & sell orders',
        '/sips': 'SIP management',
        '/redemptions': 'Redemption & delivery',
        '/gifts': 'Gift management',
        '/payments': 'Payments',
        '/refunds': 'Refunds',
        '/reconciliation': 'Reconciliation',
        '/reports': 'Reports',
        '/roles': 'Roles & permissions',
        '/settings': 'Settings',
        '/audit-logs': 'Audit logs',
      }[pathname] ?? 'Overview');

  return (
    <header className="topbar">
      <button className="icon-button mobile-menu" onClick={onMenuClick} aria-label={isMenuOpen ? 'Navigation menu open' : 'Open navigation menu'} aria-controls="main-navigation" aria-expanded={isMenuOpen}>
        <Menu size={21} />
      </button>
      <div className="breadcrumb"><span>Workspace</span><span className="breadcrumb-divider">/</span><strong>{currentPage}</strong></div>
      <div className="topbar-actions">
        <label className="global-search">
          <Search size={17} />
          <input aria-label="Search recent transactions" placeholder="Search transactions..." onChange={(event) => onSearchChange?.(event.target.value)} />
          <kbd>⌘ K</kbd>
        </label>
        <div className="popover-anchor">
          <button
            className={`icon-button notification-button ${notificationsOpen ? 'is-open' : ''}`}
            aria-label="Notifications"
            aria-expanded={notificationsOpen}
            onClick={() => { setNotificationsOpen((open) => !open); setProfileOpen(false); }}
          >
            <Bell size={19} /><span className="notification-dot" />
          </button>
          {notificationsOpen && (
            <div className="topbar-popover notification-popover">
              <div className="popover-heading"><strong>Notifications</strong><span className="tiny-count">2 new</span></div>
              <div className="notification-item"><span className="notification-icon teal"><ShieldCheck size={16} /></span><div><strong>Verification queue</strong><p>12 customer profiles need review.</p><small>12 minutes ago</small></div></div>
              <div className="notification-item"><span className="notification-icon amber"><Bell size={16} /></span><div><strong>Rate review required</strong><p>A demo rate change is awaiting approval.</p><small>38 minutes ago</small></div></div>
              <div className="popover-footnote">Notifications shown are sample data.</div>
            </div>
          )}
        </div>
        <div className="topbar-divider" />
        <div className="popover-anchor">
          <button
            className="profile-button"
            aria-expanded={profileOpen}
            onClick={() => { setProfileOpen((open) => !open); setNotificationsOpen(false); }}
          >
            <span className="profile-avatar">{activeRoleId === 'SUPER_ADMIN' ? 'SA' : 'A'}</span>
            <span className="profile-copy"><strong>{activeRole?.name}</strong><small>{user?.email}</small></span>
            <ChevronDown size={15} className="profile-chevron" />
          </button>
          {profileOpen && (
            <div className="topbar-popover profile-popover">
              <div className="profile-menu-heading"><span className="profile-avatar">{activeRoleId === 'SUPER_ADMIN' ? 'SA' : 'A'}</span><div><strong>{activeRole?.name}</strong><small>{user?.email}</small></div></div>
              <button className="profile-logout" onClick={logout}>Sign out of demo session</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
