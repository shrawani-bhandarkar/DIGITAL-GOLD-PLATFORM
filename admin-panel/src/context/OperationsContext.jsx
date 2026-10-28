import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { apiRequest } from '../services/apiClient.js';
import { useAdmin } from './AdminContext.jsx';

const OperationsContext = createContext(null);

function nowLabel() {
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
}

function addTimelineEntry(item, label, completeOpenStep = false) {
  const time = nowLabel();
  const entries = item.timeline ?? [];
  let lastOpenIndex = -1;
  if (completeOpenStep) {
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      if (!entries[index].done) {
        lastOpenIndex = index;
        break;
      }
    }
  }
  const timeline = entries.map((entry, index) => index === lastOpenIndex ? { ...entry, done: true } : entry);
  timeline.push({ label, time, done: true });
  return timeline;
}

export function OperationsProvider() {
  const { recordAudit, setPersistenceError, consoleState } = useAdmin();
  const [orders, setOrders] = useState([]);
  const [sips, setSips] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [gifts, setGifts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [settlements, setSettlements] = useState([]);

  useEffect(() => {
    if (!consoleState) return;
    setOrders(consoleState.orders ?? []);
    setSips(consoleState.sips ?? []);
    setRedemptions(consoleState.redemptions ?? []);
    setGifts(consoleState.gifts ?? []);
    setPayments(consoleState.payments ?? []);
    setRefunds(consoleState.refunds ?? []);
    setSettlements(consoleState.settlements ?? []);
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

  const value = useMemo(() => ({
    orders,
    sips,
    redemptions,
    gifts,
    payments,
    refunds,
    settlements,
    addOrder: async (order) => {
      const result = await persist('/api/admin/console/orders', { method: 'POST', body: order });
      if (!result) return false;
      setOrders((items) => [result.order ?? order, ...items]);
      if (result.payment) setPayments((items) => [result.payment, ...items]);
      recordAudit({ action: `Created ${order.type.toLowerCase()} order`, category: 'Orders', target: order.id, detail: 'Order persisted; payment remains pending until confirmed.' });
      return true;
    },
    updateOrder: async (id, status) => {
      const saved = await persist(`/api/admin/console/orders/${encodeURIComponent(id)}`, { method: 'PATCH', body: { status } });
      if (!saved) return false;
      if (saved.payment) setPayments((items) => items.map((payment) => payment.id === saved.payment.id ? saved.payment : payment));
      setOrders((items) => items.map((item) => item.id === id
        ? { ...item, status, paymentStatus: saved.payment?.status ?? item.paymentStatus, timeline: addTimelineEntry(item, `Order ${status.toLowerCase()}`, true), updatedAt: nowLabel() }
        : item));
      recordAudit({ action: `Updated order to ${status}`, category: 'Orders', target: id, detail: 'Order status persisted.' });
      return true;
    },
    addSip: async (plan) => {
      const saved = await persist('/api/admin/console/sips', { method: 'POST', body: plan });
      if (!saved) return false;
      setSips((items) => [saved.sip, ...items]);
      recordAudit({ action: 'Created SIP plan', category: 'SIPs', target: saved.sip.id, detail: 'SIP plan and monthly installment schedule persisted in MySQL.' });
      return saved.sip;
    },
    updateSip: async (id, status) => {
      const saved = await persist(`/api/admin/console/sips/${encodeURIComponent(id)}`, { method: 'PATCH', body: { status } });
      if (!saved?.sip) return false;
      setSips((items) => items.map((item) => item.id === id ? saved.sip : item));
      recordAudit({ action: `Updated SIP to ${status}`, category: 'SIPs', target: id, detail: 'SIP status persisted.' });
      return saved.sip;
    },
    fetchSipDetails: async (id) => {
      const saved = await persist(`/api/admin/console/sips/${encodeURIComponent(id)}`, {});
      return saved?.sip ? saved : null;
    },
    updateSipInstallment: async (id, action) => {
      const saved = await persist(`/api/admin/console/sips/${encodeURIComponent(id)}/installments`, {
        method: 'POST',
        body: { action },
      });
      if (!saved?.sip || !Array.isArray(saved.installments)) return null;
      setSips((items) => items.map((item) => item.id === id ? saved.sip : item));
      recordAudit({
        action: action === 'paid' ? 'Recorded SIP installment payment' : 'Skipped SIP installment',
        category: 'SIPs',
        target: id,
        detail: action === 'paid' ? 'Monthly installment marked paid.' : 'Monthly installment marked skipped and schedule extended.',
      });
      return saved;
    },
    updateRedemption: async (id, status) => {
      const saved = await persist(`/api/admin/console/redemptions/${encodeURIComponent(id)}`, { method: 'PATCH', body: { status } });
      if (!saved) return false;
      setRedemptions((items) => items.map((item) => {
        if (item.id !== id) return item;
        if (saved.data) return saved.data;
        const labels = { Processing: 'Redemption approved', Shipped: 'Parcel handed to courier', Delivered: 'Delivery marked complete', Rejected: 'Redemption rejected', Completed: 'Payout marked complete' };
        const timeline = addTimelineEntry(item, labels[status] ?? status, status !== 'Rejected');
        return { ...item, status, timeline, tracking: status === 'Shipped' && item.tracking === '—' ? `AWB-${String(Date.now()).slice(-8)}` : item.tracking };
      }));
      recordAudit({ action: `Updated redemption to ${status}`, category: 'Redemptions', target: id, detail: 'Fulfillment status persisted.' });
      return true;
    },
    addRedemption: async (redemption) => {
      const saved = await persist('/api/admin/console/redemptions', { method: 'POST', body: redemption });
      if (!saved) return false;
      setRedemptions((items) => [saved, ...items]);
      recordAudit({ action: 'Created redemption request', category: 'Redemptions', target: redemption.id, detail: 'Redemption request persisted.' });
      return true;
    },
    addGift: async (gift) => {
      const saved = await persist('/api/admin/console/gifts', { method: 'POST', body: gift });
      if (!saved) return false;
      setGifts((items) => [gift, ...items]);
      recordAudit({ action: 'Created gift record', category: 'Gifts', target: gift.id, detail: 'Gift record persisted; no payment or message was sent.' });
      return true;
    },
    updateGift: async (id, status) => {
      const saved = await persist(`/api/admin/console/gifts/${encodeURIComponent(id)}`, { method: 'PATCH', body: { status } });
      if (!saved) return false;
      setGifts((items) => items.map((item) => item.id === id
        ? { ...item, status, timeline: addTimelineEntry(item, `Gift ${status.toLowerCase()}`) }
        : item));
      recordAudit({ action: `Updated gift to ${status}`, category: 'Gifts', target: id, detail: 'Gift status persisted; no message was sent.' });
      return true;
    },
    resendGift: async (id) => {
      const saved = await persist(`/api/admin/console/gifts/${encodeURIComponent(id)}/actions`, { method: 'POST', body: { action: 'resend' } });
      if (!saved) return false;
      setGifts((items) => items.map((item) => item.id === id
        ? { ...item, timeline: addTimelineEntry(item, 'Gift resend recorded') }
        : item));
      recordAudit({ action: 'Recorded gift resend', category: 'Gifts', target: id, detail: 'Resend event persisted; no email was sent.' });
      return true;
    },
    reviewRefund: async (id, status) => {
      const saved = await persist(`/api/admin/console/refunds/${encodeURIComponent(id)}`, { method: 'PATCH', body: { status } });
      if (!saved) return false;
      setRefunds((items) => items.map((item) => item.id === id && item.status === 'Pending review'
        ? { ...item, status, reviewedAt: nowLabel(), reviewNote: `Marked ${status.toLowerCase()}` }
        : item));
      recordAudit({ action: `${status} refund request`, category: 'Refunds', target: id, detail: 'Refund review decision persisted; no refund transaction was initiated.' });
      return true;
    },
    markSettlementReviewed: async (id) => {
      const saved = await persist(`/api/admin/console/settlements/${encodeURIComponent(id)}`, { method: 'PATCH', body: { status: 'Reviewed' } });
      if (!saved) return false;
      setSettlements((items) => items.map((item) => item.id === id && item.status === 'Mismatch'
        ? { ...item, status: 'Reviewed', reviewedAt: nowLabel(), note: `${item.note} Flagged for offline review.` }
        : item));
      recordAudit({ action: 'Marked settlement mismatch reviewed', category: 'Reconciliation', target: id, detail: 'Settlement review status persisted.' });
      return true;
    },
  }), [orders, sips, redemptions, gifts, payments, refunds, settlements, recordAudit, setPersistenceError]);

  return <OperationsContext.Provider value={value}><Outlet /></OperationsContext.Provider>;
}

export function useOperations() {
  const context = useContext(OperationsContext);
  if (!context) throw new Error('useOperations must be used within OperationsProvider');
  return context;
}
