import { useState } from "react";
import {
  Activity,
  ArrowLeftRight,
  BarChart3,
  CircleDollarSign,
  Coins,
  Gift,
  Gem,
  LayoutDashboard,
  PackageCheck,
  Settings,
  Users,
} from "lucide-react";

const sections = [
  { name: "Dashboard", icon: LayoutDashboard },
  { name: "Customer Management", icon: Users },
  { name: "Gold / Silver Rate Management", icon: Coins },
  { name: "Buy / Sell Order Management", icon: ArrowLeftRight },
  { name: "SIP Management", icon: Activity },
  { name: "Redemption & Delivery", icon: PackageCheck },
  { name: "Gift Management", icon: Gift },
  { name: "Payments & Refunds", icon: CircleDollarSign },
  { name: "Reports & Reconciliation", icon: BarChart3 },
  { name: "Settings & Audit Logs", icon: Settings },
];

export default function App() {
  const [activeSection, setActiveSection] = useState("Dashboard");

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Digi Gold home">
          <span className="brand-mark"><Gem size={21} /></span>
          <span>Digi Gold</span>
        </a>
        <p className="nav-label">ADMINISTRATION</p>
        <nav aria-label="Admin sections">
          {sections.map(({ name, icon: Icon }) => (
            <button
              className={`nav-item${activeSection === name ? " active" : ""}`}
              key={name}
              onClick={() => setActiveSection(name)}
              type="button"
            >
              <Icon size={18} />
              <span>{name}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">Admin Portal</div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <span>Administration</span>
          <button className="admin-button" type="button">Admin</button>
        </header>
        <section className="page-content">
          <p className="eyebrow">DIGI GOLD ADMIN</p>
          <h1>{activeSection}</h1>
          {activeSection === "Dashboard" ? (
            <>
              <p className="intro">Manage customers, gold operations, payments, and reporting from one place.</p>
              <div className="module-grid">
                {sections.slice(1).map(({ name, icon: Icon }) => (
                  <button
                    className="module-card"
                    key={name}
                    onClick={() => setActiveSection(name)}
                    type="button"
                  >
                    <span className="module-icon"><Icon size={20} /></span>
                    <span>{name}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <h2>{activeSection}</h2>
              <p>This module is ready for its screens, API integration, and business rules.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

