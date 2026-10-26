import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RateManagementPage from '../pages/RateManagementPage.jsx';

const testState = vi.hoisted(() => ({
  activeRoleId: 'SUPER_ADMIN',
  apiRequest: vi.fn(),
}));

vi.mock('../context/AdminContext.jsx', () => ({
  useAdmin: () => ({ activeRoleId: testState.activeRoleId }),
}));

vi.mock('../context/ManagementContext.jsx', () => ({
  useManagement: () => ({
    products: [],
    rateRequests: [],
    addRateRequest: vi.fn(),
    reviewRateRequest: vi.fn(),
  }),
}));

vi.mock('../services/apiClient.js', () => ({
  apiRequest: testState.apiRequest,
}));

const initialRate = {
  id: '1',
  metalType: 'Gold',
  purity: '24K',
  ratePerGram: 7825,
  effectiveDate: '2026-10-23',
  updatedAt: '2026-10-23 12:00:00',
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  testState.activeRoleId = 'SUPER_ADMIN';
});

describe('daily metal prices', () => {
  it('saves a Superadmin rate and reloads the current database rates', async () => {
    testState.apiRequest
      .mockResolvedValueOnce({ rates: [initialRate] })
      .mockResolvedValueOnce({ rate: initialRate })
      .mockResolvedValueOnce({
        rates: [{ ...initialRate, id: '2', purity: '999.9%', ratePerGram: 7900 }],
      });
    render(<RateManagementPage />);

    await screen.findByText('24K');
    fireEvent.change(screen.getByLabelText('Rate per gram (₹)'), { target: { value: '7900' } });
    fireEvent.change(screen.getByLabelText('Purity'), { target: { value: '999.9%' } });
    fireEvent.change(screen.getByLabelText('Effective date'), { target: { value: '2026-10-24' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save daily metal price' }));

    await screen.findByText('Daily metal price saved and current rates refreshed.');
    expect(testState.apiRequest).toHaveBeenNthCalledWith(2, '/api/admin/metal-prices', {
      method: 'POST',
      body: {
        metalType: 'Gold',
        ratePerGram: 7900,
        purity: '999.9%',
        effectiveDate: '2026-10-24',
      },
    });
    expect(await screen.findByText('999.9%')).toBeInTheDocument();
  });

  it('does not render price editing controls for Admin roles', async () => {
    testState.activeRoleId = 'ADMIN';
    testState.apiRequest.mockResolvedValue({ rates: [initialRate] });
    render(<RateManagementPage />);

    await screen.findByText('24K');
    expect(screen.queryByRole('button', { name: 'Save daily metal price' })).not.toBeInTheDocument();
    expect(screen.getByText('Only the Super Admin can add or update daily prices and purity.')).toBeInTheDocument();
  });
});
