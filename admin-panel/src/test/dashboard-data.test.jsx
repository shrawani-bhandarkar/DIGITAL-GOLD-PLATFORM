import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import DashboardPage from '../pages/DashboardPage.jsx';

const dashboardState = vi.hoisted(() => ({
  products: [],
}));

vi.mock('../context/ManagementContext.jsx', () => ({
  useManagement: () => ({
    customers: [],
    products: dashboardState.products,
    rateRequests: [],
  }),
}));

vi.mock('../context/OperationsContext.jsx', () => ({
  useOperations: () => ({
    orders: [],
    payments: [],
    sips: [],
    redemptions: [],
  }),
}));

vi.mock('../context/AdminContext.jsx', () => ({
  useAdmin: () => ({
    activeRole: { name: 'Super Admin' },
    hasPermission: () => true,
    auditEvents: [],
  }),
}));

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({ user: { name: 'Super Admin' } }),
}));

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={['/']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={<Outlet context={{ dashboardSearch: '' }} />}>
          <Route index element={<DashboardPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  dashboardState.products = [];
});

describe('dashboard product data', () => {
  it('stays visible after remount when stored product JSON is missing its metal field', () => {
    dashboardState.products = [{ id: 'GOLD_24K', name: '24K Gold', status: 'Active' }];

    const firstLoad = renderDashboard();
    expect(screen.getByRole('heading', { name: 'Good morning, Super Admin' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('1 product record is missing a metal type or purity');
    firstLoad.unmount();

    renderDashboard();
    expect(screen.getByRole('heading', { name: 'Good morning, Super Admin' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('uses the restored MySQL metal metadata for indicative rates', () => {
    dashboardState.products = [{
      id: 'GOLD_24K',
      name: '24K Gold',
      metal: 'Gold',
      purity: '24K (999)',
      status: 'Active',
      buyRate: 7825,
      sellRate: 7580,
    }];

    renderDashboard();
    expect(screen.getByRole('heading', { name: 'Good morning, Super Admin' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('Sample indicative rate')).toBeInTheDocument();
    expect(within(screen.getByLabelText('Indicative metal rates')).getByText('₹7,825')).toBeInTheDocument();
  });

  it('keeps the dashboard visible and flags active products with missing numeric rates after refresh', () => {
    dashboardState.products = [{
      id: 'GOLD_24K',
      name: '24K Gold',
      metal: 'Gold',
      purity: '24K (999)',
      status: 'Active',
    }];

    for (let refresh = 0; refresh < 5; refresh += 1) {
      const dashboard = renderDashboard();
      expect(screen.getByRole('heading', { name: 'Good morning, Super Admin' })).toBeInTheDocument();
      expect(screen.getByText(/1 active product record has missing or invalid buy\/sell rates/)).toBeInTheDocument();
      expect(within(screen.getByLabelText('Indicative metal rates')).getAllByText('—')).toHaveLength(6);
      dashboard.unmount();
    }
  });
});
