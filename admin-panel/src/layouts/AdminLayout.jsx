import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar.jsx';
import Topbar from '../components/Topbar.jsx';

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dashboardSearch, setDashboardSearch] = useState('');

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
          <Outlet context={{ dashboardSearch }} />
        </main>
      </div>
    </div>
  );
}
