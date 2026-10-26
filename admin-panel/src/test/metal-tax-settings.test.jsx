import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MetalProductsPage from '../pages/MetalProductsPage.jsx';

const mocks = vi.hoisted(() => ({
  hasProductsPermission: true,
  metalTaxSettings: null,
  updateMetalTaxSettings: vi.fn(),
}));

vi.mock('../context/AdminContext.jsx', () => ({
  useAdmin: () => ({
    activeRoleId: 'ADMIN',
    hasPermission: () => mocks.hasProductsPermission,
  }),
}));

vi.mock('../context/ManagementContext.jsx', () => ({
  useManagement: () => ({
    products: [],
    saveProduct: vi.fn(),
    toggleProduct: vi.fn(),
    metalMakingCharges: [],
    updateMetalMakingCharge: vi.fn(),
    metalTaxSettings: mocks.metalTaxSettings,
    updateMetalTaxSettings: mocks.updateMetalTaxSettings,
  }),
}));

describe('Quick Buy GST settings', () => {
  afterEach(cleanup);

  beforeEach(() => {
    mocks.hasProductsPermission = true;
    mocks.metalTaxSettings = null;
    mocks.updateMetalTaxSettings.mockReset().mockResolvedValue({ success: true });
  });

  it('loads configured rates from the database-backed settings state', () => {
    mocks.metalTaxSettings = {
      sellerStateCode: 'MH',
      cgstBps: 150,
      sgstBps: 150,
      igstBps: 300,
    };
    render(<MetalProductsPage />);

    expect(screen.getByRole('combobox', { name: 'Seller state' })).toHaveValue('MH');
    expect(screen.getByRole('spinbutton', { name: 'CGST (%)' })).toHaveValue(1.5);
    expect(screen.getByRole('spinbutton', { name: 'SGST (%)' })).toHaveValue(1.5);
    expect(screen.getByRole('spinbutton', { name: 'IGST (%)' })).toHaveValue(3);
  });

  it('lets an Admin with products permission persist tax jurisdiction and rates', async () => {
    const user = userEvent.setup();
    render(<MetalProductsPage />);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Seller state' }), 'MH');
    await user.clear(screen.getByRole('spinbutton', { name: 'CGST (%)' }));
    await user.type(screen.getByRole('spinbutton', { name: 'CGST (%)' }), '2');
    await user.clear(screen.getByRole('spinbutton', { name: 'SGST (%)' }));
    await user.type(screen.getByRole('spinbutton', { name: 'SGST (%)' }), '2');
    await user.clear(screen.getByRole('spinbutton', { name: 'IGST (%)' }));
    await user.type(screen.getByRole('spinbutton', { name: 'IGST (%)' }), '4');
    await user.click(screen.getByRole('button', { name: 'Save GST settings' }));

    await waitFor(() => expect(mocks.updateMetalTaxSettings).toHaveBeenCalledWith({
      sellerStateCode: 'MH',
      cgstBps: 200,
      sgstBps: 200,
      igstBps: 400,
    }));
  });

  it('keeps GST settings read-only without products permission', () => {
    mocks.hasProductsPermission = false;
    render(<MetalProductsPage />);

    expect(screen.queryByRole('button', { name: 'Save GST settings' })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Seller state' })).toBeDisabled();
  });
});
