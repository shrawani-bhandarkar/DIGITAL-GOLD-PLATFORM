import { useState } from 'react';
import { ArrowLeft, ArrowUpRight, BadgeCheck, PackageCheck, WalletCards } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import StatusTimeline from '../components/StatusTimeline.jsx';
import SimulatedBanner from '../components/SimulatedBanner.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { useOperations } from '../context/OperationsContext.jsx';
import { formatCurrency } from '../utils/formatters.js';
import useDocumentTitle from '../hooks/useDocumentTitle.js';

export default function OrderDetailsPage() {
  const { orderId } = useParams();
  const { orders, updateOrder } = useOperations();
  const order = orders.find((item) => item.id === orderId);
  const [nextStatus, setNextStatus] = useState('');
  useDocumentTitle(order ? order.id : 'Order not found');

  if (!order) return <section className="panel not-found-panel"><h1>Order not found</h1><p>This order is not in the current demo session.</p><Link className="button button-primary" to="/orders">Back to orders</Link></section>;

  const nextAction = order.status === 'Pending' ? { status: 'Processing', label: 'Start processing' }
    : order.status === 'Processing' ? { status: 'Completed', label: 'Mark completed' } : null;

  return (
    <>
      <PageHeader eyebrow={`ORDER DETAILS · ${order.id}`} title={`${order.type} ${order.metal}`} description={`${order.customer} · placed ${order.placedAt}`} actions={<Link to="/orders" className="button button-secondary"><ArrowLeft size={15} /> All orders</Link>} />
      <SimulatedBanner>Order timeline and status changes are for demonstration only; this panel does not process real payments or metal transfers.</SimulatedBanner>
      <div className="order-detail-grid">
        <div className="order-detail-main">
          <section className="panel order-summary-panel">
            <div className="order-summary-title"><div><span className={`transaction-type-icon ${order.type.toLowerCase()}`}>{order.type === 'Buy' ? <ArrowUpRight size={17} /> : <WalletCards size={17} />}</span><span><small>Order reference</small><strong>{order.id}</strong></span></div><StatusBadge status={order.status} /></div>
            <div className="order-value-grid">
              <div><span>{order.type === 'Buy' ? 'Base purchase' : 'Gross proceeds'}</span><strong>{formatCurrency(order.baseAmount ?? order.amount)}</strong></div>
              <div><span>Metal quantity</span><strong>{Number(order.quantity).toFixed(3)} g</strong></div>
              <div><span>Rate / gram</span><strong>{formatCurrency(order.rate)}</strong></div>
              <div><span>Demo charges</span><strong>{formatCurrency(order.charges ?? 0)}</strong></div>
              <div><span>Demo taxes</span><strong>{formatCurrency(order.taxes ?? 0)}</strong></div>
              <div><span>{order.type === 'Buy' ? 'Estimated final payable' : 'Estimated net proceeds'}</span><strong>{formatCurrency(order.amount)}</strong></div>
              <div><span>Payment method</span><strong>{order.payment}</strong></div>
            </div>
            <div className="order-product-row"><PackageCheck size={16} /><span>{order.purity} {order.metal}<small>Product specification</small></span></div>
          </section>
          <section className="panel order-timeline-panel"><div className="panel-heading"><div><h2>Order status timeline</h2><p>Timestamped sample order events</p></div></div><StatusTimeline items={order.timeline} /></section>
        </div>
        <aside className="order-detail-side">
          <section className="panel order-customer-card"><div className="panel-heading"><div><h2>Customer</h2><p>Linked demo customer profile</p></div></div><div className="order-customer-content"><span className="customer-avatar">{order.customer.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><span><strong>{order.customer}</strong><small>{order.customerId}</small></span></div><Link className="table-action-link order-customer-link" to={`/customers/${order.customerId}`}>View profile</Link></section>
          <section className="panel order-action-card"><div className="panel-heading"><div><h2>Admin action</h2><p>Demo status controls</p></div></div><div className="order-action-copy"><BadgeCheck size={16} /><span>Use the control below to update this simulated order record. No external service is contacted.</span></div>{nextAction ? <button className="button button-primary order-action-button" onClick={() => setNextStatus(nextAction.status)}>{nextAction.label}</button> : <div className="reviewed-note">No further status action is available.</div>}</section>
        </aside>
      </div>
      <ConfirmDialog open={Boolean(nextStatus)} title={`${nextStatus === 'Processing' ? 'Start processing' : 'Complete'} simulated order?`} description={`This will update ${order.id} in the current demo session only.`} confirmLabel={nextStatus === 'Processing' ? 'Start processing' : 'Mark completed'} onCancel={() => setNextStatus('')} onConfirm={() => { updateOrder(order.id, nextStatus); setNextStatus(''); }} />
    </>
  );
}
