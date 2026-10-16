import { createContext, useContext, useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { initialCustomers, initialProducts, initialRateRequests } from '../data/managementData.js';
import { useAdmin } from './AdminContext.jsx';

const ManagementContext = createContext(null);

export function ManagementProvider() {
  const { recordAudit } = useAdmin();
  const [customers, setCustomers] = useState(initialCustomers);
  const [products, setProducts] = useState(initialProducts);
  const [rateRequests, setRateRequests] = useState(initialRateRequests);

  const value = useMemo(() => ({
    customers,
    products,
    rateRequests,
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
  }), [customers, products, rateRequests, recordAudit]);

  return <ManagementContext.Provider value={value}><Outlet /></ManagementContext.Provider>;
}

export function useManagement() {
  const context = useContext(ManagementContext);
  if (!context) throw new Error('useManagement must be used within ManagementProvider');
  return context;
}
