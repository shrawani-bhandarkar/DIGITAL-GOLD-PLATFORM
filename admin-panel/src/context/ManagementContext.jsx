import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { apiRequest } from '../services/apiClient.js';
import { useAdmin } from './AdminContext.jsx';

const ManagementContext = createContext(null);
const SUPPORTED_METALS = ['Gold', 'Silver', 'Platinum'];
export function ManagementProvider() {
  const { activeRoleId, hasPermission, recordAudit, setPersistenceError, consoleState } = useAdmin();
  const [customers, setCustomers] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [rateRequests, setRateRequests] = useState([]);
  const [metalMakingCharges, setMetalMakingCharges] = useState([]);
  const [metalTaxSettings, setMetalTaxSettings] = useState(null);
  const [ledgerEntries, setLedgerEntries] = useState([]);

  useEffect(() => {
    if (activeRoleId !== 'SUPER_ADMIN' && !consoleState) return;
    if (!hasPermission('customers')) {
      setCustomers([]);
      setCustomersLoading(false);
      return;
    }
    let mounted = true;
    setCustomersLoading(true);
    apiRequest('/api/admin/console/customers')
      .then((rows) => {
        if (!Array.isArray(rows)) throw new Error('API returned invalid customer data.');
        if (!mounted) return;
        setCustomers(rows);
        setPersistenceError('');
      })
      .catch((error) => {
        if (mounted) setPersistenceError(error.message);
      })
      .finally(() => {
        if (mounted) setCustomersLoading(false);
      });
    return () => { mounted = false; };
  }, [activeRoleId, consoleState, hasPermission, setPersistenceError]);

  useEffect(() => {
    if (!consoleState) return;
    setProducts(consoleState.products ?? []);
    setRateRequests(consoleState.rateRequests ?? []);
    const configuredCharges = consoleState.metalMakingCharges ?? [];
    setMetalMakingCharges(SUPPORTED_METALS.map((metal) => configuredCharges.find((item) => item.metal === metal)
      ?? { metal, chargeType: 'fixed', chargeValue: 0, enabled: false, updatedAt: 'Not configured' }));
    setMetalTaxSettings(consoleState.metalTaxSettings ?? null);
    setLedgerEntries(consoleState.ledgerEntries ?? []);
  }, [consoleState]);

  async function persist(path, options) {
    try {
      const result = await apiRequest(path, options);
      setPersistenceError('');
      return result;
    } catch (error) {
      setPersistenceError(error.message);
      return null;
    }
  }

  async function updateMetalMakingCharge(metal, chargeType, chargeValue, enabled) {
    if (!hasPermission('products')) {
      return { success: false, message: 'You do not have permission to configure metal making charges.' };
    }
    if (!SUPPORTED_METALS.includes(metal)) {
      return { success: false, message: 'Choose a supported metal.' };
    }
    if (
      !['fixed', 'percentage'].includes(chargeType)
      || !Number.isFinite(chargeValue)
      || chargeValue < 0
      || (chargeType === 'percentage' && chargeValue > 100)
      || !Number.isSafeInteger(Math.round(chargeValue * 100))
      || typeof enabled !== 'boolean'
    ) {
      return { success: false, message: 'Making charge must be a valid non-negative rupee amount or percentage, with an explicit status.' };
    }
    try {
      const result = await apiRequest(`/api/admin/console/making-charges/${encodeURIComponent(metal)}`, {
        method: 'PUT',
        body: { chargeType, chargeValue: chargeValue.toFixed(2), enabled },
      });
      if (
        result?.success !== true
        || result.makingCharge?.metal !== metal
        || result.makingCharge.chargeType !== chargeType
        || result.makingCharge.chargeValue !== chargeValue
        || result.makingCharge.enabled !== enabled
      ) {
        throw new Error('The database did not confirm the saved making charge.');
      }
      setPersistenceError('');
      const saved = result.makingCharge;
      const nextCharges = metalMakingCharges.some((item) => item.metal === metal)
        ? metalMakingCharges.map((item) => (item.metal === metal ? saved : item))
        : [...metalMakingCharges, saved];
      setMetalMakingCharges(nextCharges);
      recordAudit({
        action: 'Updated metal making charge',
        category: 'Products',
        target: metal,
        detail: `${metal} ${chargeType} making charge saved as ${enabled ? 'enabled' : 'disabled'} in MySQL.`,
      });
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save the making charge.';
      setPersistenceError(message);
      return { success: false, message };
    }
  }

  const fetchCustomerKyc = useCallback(async (customerId) => {
    try {
      const result = await apiRequest(`/api/admin/console/customers/${encodeURIComponent(customerId)}/kyc`);
      if (!Array.isArray(result?.documents)) throw new Error('API returned invalid KYC document data.');
      setPersistenceError('');
      return result.documents;
    } catch (error) {
      setPersistenceError(error.message);
      throw error;
    }
  }, [setPersistenceError]);

  const reviewCustomerKyc = useCallback(async (customerId, documentType, documentNumber, status) => {
    try {
      const result = await apiRequest(`/api/admin/console/customers/${encodeURIComponent(customerId)}/kyc`, {
        method: 'PATCH',
        body: { documentType, documentNumber, status },
      });
      if (result?.success !== true || result.documentType !== documentType || result.documentStatus !== status) {
        throw new Error('The database did not confirm the KYC review.');
      }
      setCustomers((items) => items.map((item) => item.id === customerId
        ? { ...item, kycStatus: result.kycStatus }
        : item));
      setPersistenceError('');
      recordAudit({
        action: `${status === 'Approved' ? 'Approved' : status === 'Rejected' ? 'Rejected' : 'Updated'} customer KYC`,
        category: 'Customers',
        target: customerId,
        detail: `${documentType === 'aadhaar' ? 'Aadhaar Card' : 'PAN Card'} KYC details ${status.toLowerCase()}.`,
      });
      return result;
    } catch (error) {
      setPersistenceError(error.message);
      throw error;
    }
  }, [recordAudit, setPersistenceError]);

  async function updateMetalTaxSettings(settings) {
    if (!hasPermission('products')) {
      return { success: false, message: 'You do not have permission to configure metal GST.' };
    }
    const { sellerStateCode, cgstBps, sgstBps, igstBps } = settings;
    if (
      typeof sellerStateCode !== 'string'
      || ![cgstBps, sgstBps, igstBps].every((rate) => Number.isSafeInteger(rate) && rate >= 0 && rate <= 10_000)
      || cgstBps !== sgstBps
      || cgstBps + sgstBps !== igstBps
    ) {
      return { success: false, message: 'CGST and SGST must be equal, and IGST must equal their combined rate.' };
    }
    const saved = await persist('/api/admin/console/metal-tax-settings', {
      method: 'PUT',
      body: settings,
    });
    if (!saved) return { success: false, message: 'Could not save GST settings.' };
    const nextSettings = { sellerStateCode, cgstBps, sgstBps, igstBps, updatedAt: new Date().toISOString() };
    setMetalTaxSettings(nextSettings);
    recordAudit({
      action: 'Updated metal GST settings',
      category: 'Products',
      target: 'Metal purchases',
      detail: `Saved CGST, SGST, IGST rates and seller state ${sellerStateCode} in MySQL.`,
    });
    return { success: true };
  }

  const value = useMemo(() => ({
    customers,
    customersLoading,
    products,
    rateRequests,
    metalMakingCharges,
    metalTaxSettings,
    ledgerEntries,
    fetchCustomerKyc,
    reviewCustomerKyc,
    updateMetalMakingCharge,
    updateMetalTaxSettings,
    addCustomer: async (customer) => {
      let saved;
      try {
        saved = await apiRequest('/api/admin/console/customers', { method: 'POST', body: customer });
        setPersistenceError('');
      } catch (error) {
        setPersistenceError(error.message);
        return { error: error.message };
      }
      setCustomers((items) => [saved, ...items]);
      recordAudit({ action: 'Created customer profile', category: 'Customers', target: saved.id, detail: 'Customer profile created with pending KYC.' });
      return { customer: saved };
    },
    updateCustomer: async (id, updates) => {
      const saved = await persist(`/api/admin/console/customers/${encodeURIComponent(id)}`, { method: 'PATCH', body: updates });
      if (!saved) return false;
      setCustomers((items) => items.map((item) => item.id === id ? { ...item, ...updates } : item));
      recordAudit({ action: 'Updated customer profile', category: 'Customers', target: id, detail: `Customer review fields updated: ${Object.keys(updates).join(', ')}.` });
      return true;
    },
    saveProduct: async (product) => {
      const exists = products.some((item) => item.id === product.id);
      const saved = await persist(exists ? `/api/admin/console/products/${encodeURIComponent(product.id)}` : '/api/admin/console/products', {
        method: exists ? 'PUT' : 'POST',
        body: product,
      });
      if (!saved) return false;
      setProducts((items) => {
        const exists = items.some((item) => item.id === product.id);
        return exists ? items.map((item) => item.id === product.id ? product : item) : [product, ...items];
      });
      recordAudit({ action: product.id && products.some((item) => item.id === product.id) ? 'Updated metal product' : 'Created metal product', category: 'Products', target: product.id, detail: 'Demo product catalog updated.' });
      return true;
    },
    toggleProduct: async (id) => {
      const current = products.find((item) => item.id === id);
      if (!current) return;
      const updated = { ...current, status: current.status === 'Active' ? 'Inactive' : 'Active' };
      const saved = await persist(`/api/admin/console/products/${encodeURIComponent(id)}`, { method: 'PUT', body: updated });
      if (!saved) return false;
      setProducts((items) => items.map((item) => item.id === id ? updated : item));
      if (current) recordAudit({ action: `${current.status === 'Active' ? 'Deactivated' : 'Activated'} metal product`, category: 'Products', target: id, detail: 'Demo product availability changed.' });
      return true;
    },
    addRateRequest: async (request) => {
      const saved = await persist('/api/admin/console/rate-requests', { method: 'POST', body: request });
      if (!saved) return false;
      setRateRequests((items) => [request, ...items]);
      recordAudit({ action: 'Submitted rate change request', category: 'Rates', target: request.id, detail: `${request.metal} ${request.purity} rate submitted for review.` });
      return true;
    },
    reviewRateRequest: async (id, status) => {
      const request = rateRequests.find((item) => item.id === id);
      const saved = await persist(`/api/admin/console/rate-requests/${encodeURIComponent(id)}`, { method: 'PATCH', body: { status } });
      if (!saved) return false;
      setRateRequests((items) => items.map((item) => item.id === id ? { ...item, status } : item));
      if (request) recordAudit({ action: `${status} rate request`, category: 'Rates', target: id, detail: `${request.metal} rate decision recorded in demo state.` });
      if (status === 'Approved' && request) {
        setProducts((items) => items.map((item) => (
          item.metal === request.metal && request.purity.includes(item.purity)
            ? { ...item, buyRate: request.buyRate, sellRate: request.sellRate }
            : item
        )));
      }
      return true;
    },
  }), [customers, customersLoading, products, rateRequests, metalMakingCharges, ledgerEntries, recordAudit, activeRoleId, setPersistenceError, fetchCustomerKyc, reviewCustomerKyc]);

  return <ManagementContext.Provider value={value}><Outlet /></ManagementContext.Provider>;
}

export function useManagement() {
  const context = useContext(ManagementContext);
  if (!context) throw new Error('useManagement must be used within ManagementProvider');
  return context;
}
