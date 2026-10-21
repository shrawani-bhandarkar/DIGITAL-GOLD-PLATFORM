import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar.jsx';
import Topbar from '../components/Topbar.jsx';
import { useAdmin } from '../context/AdminContext.jsx';

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dashboardSearch, setDashboardSearch] = useState('');
  const { persistenceError, setPersistenceError } = useAdmin();

  return (
    <div className="app-shell">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      {sidebarOpen && (
        <button
          aria-label="Close navigation menu"
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div className="main-column">
        <Topbar isMenuOpen={sidebarOpen} onMenuClick={() => setSidebarOpen(true)} onSearchChange={setDashboardSearch} />
        <main className="main-content">
          {persistenceError && <div className="login-error" role="alert"><span>{persistenceError}</span><button className="text-action" onClick={() => setPersistenceError('')}>Dismiss</button></div>}
          <Outlet context={{ dashboardSearch }} />
        </main>
      </div>
    </div>
  );
}
