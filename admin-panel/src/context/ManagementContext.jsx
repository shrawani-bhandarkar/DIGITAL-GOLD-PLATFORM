import { createContext, useContext, useEffect, useMemo, useState } from 'react';
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
      ?? { metal, chargePerGramPaise: 0, enabled: false, updatedAt: 'Not configured' }));
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

  async function updateMetalMakingCharge(metal, chargePerGramPaise, enabled) {
    if (activeRoleId !== 'SUPER_ADMIN') {
      return { success: false, message: 'Only Super Admin can configure metal making charges.' };
    }
    if (!SUPPORTED_METALS.includes(metal)) {
      return { success: false, message: 'Choose a supported metal.' };
    }
    if (!Number.isSafeInteger(chargePerGramPaise) || chargePerGramPaise < 0 || typeof enabled !== 'boolean') {
      return { success: false, message: 'Making charge must be a non-negative amount and have an explicit status.' };
    }
    const updatedAt = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
    try {
      const saved = await persist(`/api/admin/console/making-charges/${encodeURIComponent(metal)}`, {
        method: 'PUT',
        body: { chargePerGramPaise, enabled },
      });
      if (!saved) return { success: false, message: 'Could not save the making charge.' };
    } catch (error) { return { success: false, message: error.message }; }
    const nextCharges = metalMakingCharges.some((item) => item.metal === metal)
      ? metalMakingCharges.map((item) => item.metal === metal
      ? { ...item, chargePerGramPaise, enabled, updatedAt }
      : item)
      : [...metalMakingCharges, { metal, chargePerGramPaise, enabled, updatedAt }];
    setMetalMakingCharges(nextCharges);
    setPersistenceError('');
    recordAudit({
      action: 'Updated metal making charge',
      category: 'Products',
      target: metal,
      detail: `${metal} making charge configured as ${enabled ? 'enabled' : 'disabled'} in demo settings.`,
    });
    return { success: true };
  }

  const value = useMemo(() => ({
    customers,
    customersLoading,
    products,
    rateRequests,
    metalMakingCharges,
    ledgerEntries,
    updateMetalMakingCharge,
    addCustomer: async (customer) => {
      const saved = await persist('/api/admin/console/customers', { method: 'POST', body: customer });
      if (!saved) return null;
      setCustomers((items) => [saved, ...items]);
      recordAudit({ action: 'Created customer profile', category: 'Customers', target: saved.id, detail: 'Customer profile created with pending KYC.' });
      return saved;
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
  }), [customers, customersLoading, products, rateRequests, metalMakingCharges, ledgerEntries, recordAudit, activeRoleId, setPersistenceError]);

  return <ManagementContext.Provider value={value}><Outlet /></ManagementContext.Provider>;
}

export function useManagement() {
  const context = useContext(ManagementContext);
  if (!context) throw new Error('useManagement must be used within ManagementProvider');
  return context;
}
