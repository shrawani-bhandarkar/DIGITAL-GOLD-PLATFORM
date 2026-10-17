import { createContext, useContext, useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { initialCustomers, initialMetalMakingCharges, initialProducts, initialRateRequests } from '../data/managementData.js';
import { useAdmin } from './AdminContext.jsx';

const ManagementContext = createContext(null);
const MAKING_CHARGE_STORAGE_KEY = 'digital-gold-demo-metal-making-charges';

function readMetalMakingCharges() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(MAKING_CHARGE_STORAGE_KEY) ?? 'null');
    if (!Array.isArray(stored)) return initialMetalMakingCharges;
    const byMetal = new Map(stored.map((item) => [item?.metal, item]));
    return initialMetalMakingCharges.map((defaults) => {
      const value = byMetal.get(defaults.metal);
      return value
        && Number.isSafeInteger(value.chargePerGramPaise)
        && value.chargePerGramPaise >= 0
        && typeof value.enabled === 'boolean'
        && typeof value.updatedAt === 'string'
        ? { ...defaults, ...value }
        : defaults;
    });
  } catch {
    return initialMetalMakingCharges;
  }
}

export function ManagementProvider() {
  const { activeRoleId, recordAudit } = useAdmin();
  const [customers, setCustomers] = useState(initialCustomers);
  const [products, setProducts] = useState(initialProducts);
  const [rateRequests, setRateRequests] = useState(initialRateRequests);
  const [metalMakingCharges, setMetalMakingCharges] = useState(readMetalMakingCharges);

  function updateMetalMakingCharge(metal, chargePerGramPaise, enabled) {
    if (activeRoleId !== 'SUPER_ADMIN') {
      return { success: false, message: 'Only Super Admin can configure metal making charges.' };
    }
    if (!initialMetalMakingCharges.some((item) => item.metal === metal)) {
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
    const nextCharges = metalMakingCharges.map((item) => item.metal === metal
      ? { ...item, chargePerGramPaise, enabled, updatedAt }
      : item);
    try {
      window.localStorage.setItem(MAKING_CHARGE_STORAGE_KEY, JSON.stringify(nextCharges));
    } catch {
      return { success: false, message: 'Could not save demo making charges in this browser.' };
    }
    setMetalMakingCharges(nextCharges);
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
    products,
    rateRequests,
    metalMakingCharges,
    updateMetalMakingCharge,
    addCustomer: (customer) => {
      setCustomers((items) => [customer, ...items]);
      recordAudit({ action: 'Created customer profile', category: 'Customers', target: customer.id, detail: 'Demo customer profile created with pending KYC.' });
    },
    updateCustomer: (id, updates) => {
      setCustomers((items) => items.map((item) => item.id === id ? { ...item, ...updates } : item));
      recordAudit({ action: 'Updated customer profile', category: 'Customers', target: id, detail: `Customer review fields updated: ${Object.keys(updates).join(', ')}.` });
    },
    saveProduct: (product) => {
      setProducts((items) => {
        const exists = items.some((item) => item.id === product.id);
        return exists ? items.map((item) => item.id === product.id ? product : item) : [product, ...items];
      });
      recordAudit({ action: product.id && products.some((item) => item.id === product.id) ? 'Updated metal product' : 'Created metal product', category: 'Products', target: product.id, detail: 'Demo product catalog updated.' });
    },
    toggleProduct: (id) => {
      const current = products.find((item) => item.id === id);
      setProducts((items) => items.map((item) => item.id === id ? { ...item, status: item.status === 'Active' ? 'Inactive' : 'Active' } : item));
      if (current) recordAudit({ action: `${current.status === 'Active' ? 'Deactivated' : 'Activated'} metal product`, category: 'Products', target: id, detail: 'Demo product availability changed.' });
    },
    addRateRequest: (request) => {
      setRateRequests((items) => [request, ...items]);
      recordAudit({ action: 'Submitted rate change request', category: 'Rates', target: request.id, detail: `${request.metal} ${request.purity} rate submitted for review.` });
    },
    reviewRateRequest: (id, status) => {
      const request = rateRequests.find((item) => item.id === id);
      setRateRequests((items) => items.map((item) => item.id === id ? { ...item, status } : item));
      if (request) recordAudit({ action: `${status} rate request`, category: 'Rates', target: id, detail: `${request.metal} rate decision recorded in demo state.` });
      if (status === 'Approved' && request) {
        setProducts((items) => items.map((item) => (
          item.metal === request.metal && request.purity.includes(item.purity)
            ? { ...item, buyRate: request.buyRate, sellRate: request.sellRate }
            : item
        )));
      }
    },
  }), [customers, products, rateRequests, metalMakingCharges, recordAudit, activeRoleId]);

  return <ManagementContext.Provider value={value}><Outlet /></ManagementContext.Provider>;
}

export function useManagement() {
  const context = useContext(ManagementContext);
  if (!context) throw new Error('useManagement must be used within ManagementProvider');
  return context;
}
