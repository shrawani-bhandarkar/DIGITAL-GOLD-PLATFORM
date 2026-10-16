import { createContext, useContext, useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { initialGifts, initialOrders, initialPayments, initialRedemptions, initialRefunds, initialSettlements, initialSips } from '../data/managementData.js';
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
  const { recordAudit } = useAdmin();
  const [orders, setOrders] = useState(initialOrders);
  const [sips, setSips] = useState(initialSips);
  const [redemptions, setRedemptions] = useState(initialRedemptions);
  const [gifts, setGifts] = useState(initialGifts);
  const [payments] = useState(initialPayments);
  const [refunds, setRefunds] = useState(initialRefunds);
  const [settlements, setSettlements] = useState(initialSettlements);

  const value = useMemo(() => ({
    orders,
    sips,
    redemptions,
    gifts,
    payments,
    refunds,
    settlements,
    addOrder: (order) => {
      setOrders((items) => [order, ...items]);
      recordAudit({ action: `Created ${order.type.toLowerCase()} order`, category: 'Orders', target: order.id, detail: 'Simulated order record created; no payment or metal movement.' });
    },
    updateOrder: (id, status) => {
      setOrders((items) => items.map((item) => item.id === id
        ? { ...item, status, timeline: addTimelineEntry(item, `Order ${status.toLowerCase()} (simulated)`, true), updatedAt: nowLabel() }
        : item));
      recordAudit({ action: `Updated order to ${status}`, category: 'Orders', target: id, detail: 'Simulated order status changed; no external transaction.' });
    },
    addSip: (sip) => {
      setSips((items) => [sip, ...items]);
      recordAudit({ action: 'Created SIP plan', category: 'SIPs', target: sip.id, detail: 'Simulated plan created; no installment debit.' });
    },
    updateSip: (id, status) => {
      setSips((items) => items.map((item) => item.id === id
        ? { ...item, status, timeline: addTimelineEntry(item, `Plan ${status.toLowerCase()} (simulated)`) }
        : item));
      recordAudit({ action: `Updated SIP to ${status}`, category: 'SIPs', target: id, detail: 'Simulated plan status changed; no installment debit.' });
    },
    updateRedemption: (id, status) => {
      setRedemptions((items) => items.map((item) => {
        if (item.id !== id) return item;
        const labels = { Processing: 'Redemption approved', Shipped: 'Parcel handed to courier', Delivered: 'Delivery marked complete', Rejected: 'Redemption rejected', Completed: 'Payout marked complete' };
        const timeline = addTimelineEntry(item, `${labels[status] ?? status} (simulated)`, status !== 'Rejected');
        return { ...item, status, timeline, tracking: status === 'Shipped' && item.tracking === '—' ? `AWB-DEMO-${String(Date.now()).slice(-6)}` : item.tracking };
      }));
      recordAudit({ action: `Updated redemption to ${status}`, category: 'Redemptions', target: id, detail: 'Simulated fulfillment status changed; no asset or payment movement.' });
    },
    addRedemption: (redemption) => {
      setRedemptions((items) => [redemption, ...items]);
      recordAudit({ action: 'Created redemption request', category: 'Redemptions', target: redemption.id, detail: 'Simulated redemption record created.' });
    },
    addGift: (gift) => {
      setGifts((items) => [gift, ...items]);
      recordAudit({ action: 'Created gift record', category: 'Gifts', target: gift.id, detail: 'Simulated gift created; no payment or message sent.' });
    },
    updateGift: (id, status) => {
      setGifts((items) => items.map((item) => item.id === id
        ? { ...item, status, timeline: addTimelineEntry(item, `Gift ${status.toLowerCase()} (simulated)`) }
        : item));
      recordAudit({ action: `Updated gift to ${status}`, category: 'Gifts', target: id, detail: 'Simulated gift status changed; no message sent.' });
    },
    resendGift: (id) => {
      setGifts((items) => items.map((item) => item.id === id
        ? { ...item, timeline: addTimelineEntry(item, 'Gift email resent (simulated)') }
        : item));
      recordAudit({ action: 'Recorded gift resend', category: 'Gifts', target: id, detail: 'Resend event logged; no email sent.' });
    },
    reviewRefund: (id, status) => {
      setRefunds((items) => items.map((item) => item.id === id && item.status === 'Pending review'
        ? { ...item, status, reviewedAt: nowLabel(), reviewNote: `Marked ${status.toLowerCase()} in demo only` }
        : item));
      recordAudit({ action: `${status} refund request`, category: 'Refunds', target: id, detail: 'Demo review decision only; no refund transaction.' });
    },
    markSettlementReviewed: (id) => {
      setSettlements((items) => items.map((item) => item.id === id && item.status === 'Mismatch'
        ? { ...item, status: 'Reviewed', reviewedAt: nowLabel(), note: `${item.note} Flagged for offline review (simulated).` }
        : item));
      recordAudit({ action: 'Marked settlement mismatch reviewed', category: 'Reconciliation', target: id, detail: 'Demo review label only; settlement values unchanged.' });
    },
  }), [orders, sips, redemptions, gifts, payments, refunds, settlements, recordAudit]);

  return <OperationsContext.Provider value={value}><Outlet /></OperationsContext.Provider>;
}

export function useOperations() {
  const context = useContext(OperationsContext);
  if (!context) throw new Error('useOperations must be used within OperationsProvider');
  return context;
}
