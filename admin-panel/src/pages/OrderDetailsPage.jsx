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

  const isQuickBuy = order.source === 'customer-quick-buy';
  const nextAction = order.status === 'Pending' ? { status: 'Processing', label: 'Start processing' }
    : order.status === 'Processing' && !isQuickBuy ? { status: 'Completed', label: 'Mark completed' } : null;
  const canCancelQuickBuy = isQuickBuy && ['Pending', 'Processing'].includes(order.status);
  const nextStatusLabel = nextStatus === 'Processing' ? 'Start processing'
    : nextStatus === 'Cancelled' ? 'Cancel order' : 'Complete';

  return (
    <>
      <PageHeader eyebrow={`ORDER DETAILS · ${order.id}`} title={`${order.type} ${order.metal}`} description={`${order.customer} · placed ${order.placedAt}`} actions={<Link to="/orders" className="button button-secondary"><ArrowLeft size={15} /> All orders</Link>} />
      <SimulatedBanner>{isQuickBuy
        ? 'This customer Quick Buy order and its status are stored in MySQL. Payment is pending because no payment gateway is configured; this panel cannot collect or confirm payment.'
        : 'Order timeline and status changes are for demonstration only; this panel does not process real payments or metal transfers.'}</SimulatedBanner>
      <div className="order-detail-grid">
        <div className="order-detail-main">
          <section className="panel order-summary-panel">
            <div className="order-summary-title"><div><span className={`transaction-type-icon ${order.type.toLowerCase()}`}>{order.type === 'Buy' ? <ArrowUpRight size={17} /> : <WalletCards size={17} />}</span><span><small>Order reference</small><strong>{order.id}</strong></span></div><StatusBadge status={order.status} /></div>
            <div className="order-value-grid">
              <div><span>{order.type === 'Buy' ? 'Metal value' : 'Gross proceeds'}</span><strong>{formatCurrency(order.baseAmount ?? order.amount)}</strong></div>
              <div><span>Metal quantity</span><strong>{Number(order.quantity).toFixed(3)} g</strong></div>
              <div><span>Rate / gram</span><strong>{formatCurrency(order.rate)}</strong></div>
              {order.type === 'Buy' && Number.isFinite(order.purchaseSubtotal) && <>
                <div><span>Fixed making charge / purchase</span><strong>{formatCurrency(order.makingChargePerPurchase ?? 0)}{order.makingChargeEnabled ? '' : ' · disabled'}</strong></div>
                <div><span>Total making charges</span><strong>{formatCurrency(order.makingCharges ?? 0)}</strong></div>
                <div><span>Purchase subtotal</span><strong>{formatCurrency(order.purchaseSubtotal)}</strong></div>
              </>}
              <div><span>{order.type === 'Buy' ? (isQuickBuy ? 'Other configured charges' : 'Other demo charges') : 'Demo selling charges'}</span><strong>{formatCurrency(order.charges ?? 0)}</strong></div>
              {isQuickBuy && order.taxBreakdown ? <>
                <div><span>CGST ({order.customerStateCode} billing state)</span><strong>{formatCurrency(order.taxBreakdown.cgst)}</strong></div>
                <div><span>SGST</span><strong>{formatCurrency(order.taxBreakdown.sgst)}</strong></div>
                {order.taxBreakdown.igst > 0 ? <div><span>IGST</span><strong>{formatCurrency(order.taxBreakdown.igst)}</strong></div> : null}
                <div><span>GST jurisdiction</span><strong>{order.taxJurisdiction} · seller state {order.sellerStateCode}</strong></div>
              </> : null}
              <div><span>{isQuickBuy ? 'GST total' : 'Configured demo taxes'}</span><strong>{formatCurrency(order.taxes ?? 0)}</strong></div>
              <div><span>{order.type === 'Buy' ? (isQuickBuy ? 'Total payable' : 'Estimated final payable') : 'Estimated net proceeds'}</span><strong>{formatCurrency(order.amount)}</strong></div>
              <div><span>Payment method</span><strong>{order.payment}</strong></div>
              <div><span>Payment status</span><strong>{order.paymentStatus ?? 'Pending'}</strong></div>
            </div>
            <div className="order-product-row"><PackageCheck size={16} /><span>{order.purity} {order.metal}<small>Product specification</small></span></div>
          </section>
          <section className="panel order-timeline-panel"><div className="panel-heading"><div><h2>Order status timeline</h2><p>Timestamped sample order events</p></div></div><StatusTimeline items={order.timeline} /></section>
        </div>
        <aside className="order-detail-side">
          <section className="panel order-customer-card"><div className="panel-heading"><div><h2>Customer</h2><p>{isQuickBuy ? 'Linked customer profile' : 'Linked demo customer profile'}</p></div></div><div className="order-customer-content"><span className="customer-avatar">{order.customer.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><span><strong>{order.customer}</strong><small>{order.customerId}</small></span></div><Link className="table-action-link order-customer-link" to={`/customers/${order.customerId}`}>View profile</Link></section>
          <section className="panel order-action-card"><div className="panel-heading"><div><h2>Admin action</h2><p>{isQuickBuy ? 'Persisted order status' : 'Demo status controls'}</p></div></div><div className="order-action-copy"><BadgeCheck size={16} /><span>{isQuickBuy ? 'Order status changes are saved. Completion is blocked until payment is confirmed by a configured gateway.' : 'Use the control below to update this simulated order record. No external service is contacted.'}</span></div>{nextAction ? <button className="button button-primary order-action-button" onClick={() => setNextStatus(nextAction.status)}>{nextAction.label}</button> : null}{canCancelQuickBuy ? <button className="button button-secondary order-action-button" onClick={() => setNextStatus('Cancelled')}>Cancel order</button> : null}{!nextAction && !canCancelQuickBuy ? <div className="reviewed-note">{isQuickBuy && order.status === 'Processing' ? 'This order cannot be completed while payment is pending.' : 'No further status action is available.'}</div> : null}</section>
        </aside>
      </div>
      <ConfirmDialog open={Boolean(nextStatus)} title={`${nextStatusLabel} ${isQuickBuy ? 'order' : 'simulated order'}?`} description={isQuickBuy ? `This will save the status change for ${order.id}. Payment remains pending.` : `This will update ${order.id} in the current demo session only.`} confirmLabel={nextStatusLabel} onCancel={() => setNextStatus('')} onConfirm={() => { updateOrder(order.id, nextStatus); setNextStatus(''); }} />
    </>
  );
}
