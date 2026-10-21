import { useEffect, useMemo, useState } from 'react';
import { Check, PackageCheck, Search, Truck, X } from 'lucide-react';
import DataTable from '../components/DataTable.jsx';
import PageHeader from '../components/PageHeader.jsx';
import Pagination from '../components/Pagination.jsx';
import Modal from '../components/Modal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import SimulatedBanner from '../components/SimulatedBanner.jsx';
import StatusTimeline from '../components/StatusTimeline.jsx';
import { useManagement } from '../context/ManagementContext.jsx';
import { useOperations } from '../context/OperationsContext.jsx';
import { formatCurrency } from '../utils/formatters.js';
import { assertQuantityWithinConfiguredLimits, calculatePortfolio, calculateRedemptionQuote, formatGrams, formatPaise, productFeePolicy } from '../utils/financial.js';
import useDocumentTitle from '../hooks/useDocumentTitle.js';

const PAGE_SIZE = 7;

export default function RedemptionDeliveryPage() {
  useDocumentTitle('Redemption & delivery');
  const { customers, products, ledgerEntries } = useManagement();
  const { orders, redemptions, updateRedemption, addRedemption } = useOperations();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All statuses');
  const [modeFilter, setModeFilter] = useState('All fulfillment');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [detailsId, setDetailsId] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const [formError, setFormError] = useState('');
  const [operationNotice, setOperationNotice] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [enteredQuantity, setEnteredQuantity] = useState('');
  const [mode, setMode] = useState('Coin delivery');
  const portfolio = calculatePortfolio(ledgerEntries);
  const availableMilliGrams = portfolio.find((holding) => holding.customerId === selectedCustomerId && holding.productId === selectedProductId)?.availableMilliGrams ?? 0;
  const selectedProduct = products.find((product) => product.id === selectedProductId && product.status === 'Active');
  let quote = null;
  let quoteError = '';
  if (selectedProduct && enteredQuantity) {
    try {
      const modeAllowed = mode === 'Coin delivery' ? selectedProduct.allowCoinDelivery : selectedProduct.allowCashPayout;
      if (!selectedProduct.redemptionEnabled || !modeAllowed) throw new RangeError('Redemption rules for this product and fulfillment method are not configured.');
      quote = calculateRedemptionQuote({
        quantity: enteredQuantity,
        ratePerGram: mode === 'Cash payout' ? selectedProduct.sellRate : selectedProduct.buyRate,
        mode,
        feePolicy: productFeePolicy(selectedProduct),
      });
      assertQuantityWithinConfiguredLimits(quote.quantityMilliGrams, {
        minimum: selectedProduct.minRedemptionQuantity,
        maximum: selectedProduct.maxRedemptionQuantity,
        label: 'Redemption quantity',
      });
      if (quote.quantityMilliGrams > availableMilliGrams) quoteError = `Requested quantity cannot exceed the available ${formatGrams(availableMilliGrams)}.`;
    } catch (error) {
      quoteError = error.message;
    }
  }
  const detail = redemptions.find((item) => item.id === detailsId);
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(() => redemptions.filter((item) => (
    [item.id, item.customer, item.customerId, item.metal, item.tracking].some((value) => value.toLowerCase().includes(normalizedQuery))
    && (statusFilter === 'All statuses' || item.status === statusFilter)
    && (modeFilter === 'All fulfillment' || item.mode === modeFilter)
  )), [redemptions, normalizedQuery, statusFilter, modeFilter]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  async function submitRedemption(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const customer = customers.find((item) => item.id === data.customerId);
    const product = products.find((item) => item.id === data.productId && item.status === 'Active');
    if (!customer || !product) {
      setFormError('Select a customer and an active metal product.');
      return;
    }
    const modeAllowed = data.mode === 'Coin delivery' ? product.allowCoinDelivery : product.allowCashPayout;
    if (!product.redemptionEnabled || !modeAllowed) {
      setFormError('Redemption rules for this product and fulfillment method are not configured.');
      return;
    }
    let calculation;
    try {
      calculation = calculateRedemptionQuote({
        quantity: data.quantity,
        ratePerGram: data.mode === 'Cash payout' ? product.sellRate : product.buyRate,
        mode: data.mode,
        feePolicy: productFeePolicy(product),
      });
      assertQuantityWithinConfiguredLimits(calculation.quantityMilliGrams, {
        minimum: product.minRedemptionQuantity,
        maximum: product.maxRedemptionQuantity,
        label: 'Redemption quantity',
      });
    } catch (error) {
      setFormError(error.message);
      return;
    }
    const latestPortfolio = calculatePortfolio(ledgerEntries);
    const latestAvailable = latestPortfolio.find((holding) => holding.customerId === customer.id && holding.productId === product.id)?.availableMilliGrams ?? 0;
    if (calculation.quantityMilliGrams > latestAvailable) {
      setFormError(`Requested quantity cannot exceed the available ${formatGrams(latestAvailable)}.`);
      return;
    }
    if (data.mode === 'Coin delivery' && data.address.trim().length < 12) {
      setFormError('Enter a complete delivery address of at least 12 characters.');
      return;
    }
    const address = data.mode === 'Cash payout' ? 'Bank payout · demo account ending 4821' : data.address.trim();
    const newItem = {
      id: `RDM-2026-${String(Date.now()).slice(-5)}`, customerId: customer.id, productId: product.id,
      customer: customer.name, metal: product.metal, purity: product.purity,
      quantity: calculation.quantityMilliGrams / 1000, amount: calculation.totalPaise / 100,
      grossAmount: calculation.grossPaise / 100, deliveryCharge: calculation.deliveryChargePaise / 100,
      taxes: calculation.taxPaise / 100, mode: data.mode, address, tracking: '—',
      requestedAt: '15 Oct 2026, just now', status: 'Pending',
      timeline: [{ label: 'Redemption requested (simulated)', time: '15 Oct, just now', done: true }, { label: 'Review and fulfillment', time: 'Awaiting admin review', done: false }],
    };
    const saved = await addRedemption(newItem);
    if (!saved) { setFormError('Could not save the redemption. Check the database connection and try again.'); return; }
    setFormOpen(false);
    setFormError('');
    setEnteredQuantity('');
    setSelectedCustomerId('');
    setSelectedProductId('');
  }

  function statusAction(item) {
    if (item.status === 'Pending') return { status: 'Processing', label: 'Approve request' };
    if (item.status === 'Processing') return item.mode === 'Coin delivery'
      ? { status: 'Shipped', label: 'Mark shipped' }
      : { status: 'Completed', label: 'Mark payout complete' };
    if (item.status === 'Shipped') return { status: 'Delivered', label: 'Mark delivered' };
    return null;
  }

  function openAction(item, status) {
    setConfirmation({ item, status, label: status === 'Rejected' ? 'Reject request' : statusAction(item)?.label });
  }

  const columns = [
    { key: 'id', label: 'Redemption', render: (value, row) => <button className="inline-table-link" onClick={() => setDetailsId(row.id)}><strong>{value}</strong><small>{row.requestedAt}</small></button> },
    { key: 'customer', label: 'Customer', render: (value, row) => <div className="management-secondary"><strong>{value}</strong><small>{row.metal} · {row.quantity} g</small></div> },
    { key: 'mode', label: 'Fulfillment', render: (value) => <span className="fulfillment-label">{value === 'Coin delivery' ? <Truck size={13} /> : <PackageCheck size={13} />}{value}</span> },
    { key: 'amount', label: 'Value', align: 'right', render: (value) => <strong>{formatCurrency(value)}</strong> },
    { key: 'tracking', label: 'Tracking', render: (value) => <span className="table-muted">{value}</span> },
    { key: 'status', label: 'Status', render: (value) => <StatusBadge status={value} /> },
    { key: 'actions', label: 'Actions', render: (_, row) => <div className="table-row-actions"><button className="table-action-link" onClick={() => setDetailsId(row.id)} aria-label={`View ${row.id}`}>View</button>{row.status === 'Pending' && <><button className="review-icon approve" onClick={() => openAction(row, 'Processing')} aria-label={`Approve ${row.id}`}><Check size={14} /></button><button className="review-icon reject" onClick={() => openAction(row, 'Rejected')} aria-label={`Reject ${row.id}`}><X size={14} /></button></>}</div> },
  ];

  return (
    <>
      <PageHeader eyebrow="FULFILLMENT OPERATIONS" title="Redemption & delivery" description="Track customer metal redemptions, cash payouts, and physical delivery." actions={<button className="button button-primary" onClick={() => { setFormError(''); setEnteredQuantity(''); setSelectedCustomerId(''); setSelectedProductId(''); setMode('Coin delivery'); setFormOpen(true); }}><PackageCheck size={15} /> Create redemption</button>} />
      <SimulatedBanner>Requests and status history are stored in MySQL. No metal, parcel, or money is moved.</SimulatedBanner>
      {operationNotice && <div className="operation-notice" role="status">{operationNotice}<button onClick={() => setOperationNotice('')} aria-label="Dismiss notice"><X size={14} /></button></div>}
      <section className="management-stat-grid">
        <article><span className="management-stat-icon stat-icon-teal"><PackageCheck size={17} /></span><div><span>Total requests</span><strong>{redemptions.length}</strong></div></article>
        <article><span className="management-stat-icon stat-icon-amber"><Truck size={17} /></span><div><span>Awaiting review</span><strong>{redemptions.filter((item) => item.status === 'Pending').length}</strong></div></article>
        <article><span className="management-stat-icon stat-icon-blue"><Check size={17} /></span><div><span>In transit</span><strong>{redemptions.filter((item) => item.status === 'Shipped').length}</strong></div></article>
      </section>
      <section className="panel management-panel">
        <div className="management-toolbar">
          <label className="management-search"><Search size={16} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search request, customer or tracking" aria-label="Search redemptions" /></label>
          <div className="management-filters">
            <select value={modeFilter} onChange={(event) => { setModeFilter(event.target.value); setPage(1); }} aria-label="Filter fulfillment"><option>All fulfillment</option><option>Coin delivery</option><option>Cash payout</option></select>
            <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} aria-label="Filter redemption status"><option>All statuses</option><option>Pending</option><option>Processing</option><option>Shipped</option><option>Delivered</option><option>Completed</option><option>Rejected</option></select>
          </div>
        </div>
        <DataTable columns={columns} rows={rows} allRows={filtered} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
        <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
      </section>
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Create redemption" description="Create a stored fulfillment request. No customer funds or metal will be transferred.">
        <form className="management-form" onSubmit={submitRedemption}>
          <div className="form-grid">
            <label className="field-block form-grid-full"><span>Customer</span><select name="customerId" required value={selectedCustomerId} onChange={(event) => setSelectedCustomerId(event.target.value)}><option value="" disabled>Select a customer</option>{customers.filter((customer) => customer.status === 'Active' && customer.kycStatus === 'Verified').map((customer) => <option key={customer.id} value={customer.id}>{customer.name} · {customer.id}</option>)}</select></label>
            <label className="field-block"><span>Active metal</span><select name="productId" required value={selectedProductId} onChange={(event) => { const product = products.find((item) => item.id === event.target.value); setSelectedProductId(event.target.value); setMode(product?.allowCoinDelivery ? 'Coin delivery' : 'Cash payout'); }}><option value="" disabled>Select product</option>{products.filter((product) => product.status === 'Active').map((product) => <option key={product.id} value={product.id} disabled={!product.redemptionEnabled || (!product.allowCoinDelivery && !product.allowCashPayout)}>{product.name} · {product.purity}{product.redemptionEnabled ? '' : ' · redemption not configured'}</option>)}</select></label>
            <label className="field-block"><span>Quantity (grams)</span><input name="quantity" type="number" min={selectedProduct?.minRedemptionQuantity || '0.001'} max={Math.min(selectedProduct?.maxRedemptionQuantity ? Number(selectedProduct.maxRedemptionQuantity) : Number.POSITIVE_INFINITY, availableMilliGrams / 1000)} step="0.001" required value={enteredQuantity} onChange={(event) => setEnteredQuantity(event.target.value)} placeholder="1.000" /></label>
            <label className="field-block form-grid-full"><span>Fulfillment method</span><select name="mode" value={mode} onChange={(event) => setMode(event.target.value)}><option disabled={selectedProduct && !selectedProduct.allowCoinDelivery}>Coin delivery</option><option disabled={selectedProduct && !selectedProduct.allowCashPayout}>Cash payout</option></select></label>
            <label className="field-block form-grid-full"><span>Delivery address <small className="optional-label">(used for coin delivery)</small></span><textarea name="address" rows="2" maxLength="240" placeholder="House, street, city, state, postal code" /></label>
          </div>
          {selectedCustomerId && selectedProductId && <p className="form-help">Eligible available quantity: {formatGrams(availableMilliGrams)} · Demo ledger only.</p>}
          {quote && !quoteError && <div className="quote-breakdown" aria-label="Estimated redemption breakdown">
            <div><span>{mode === 'Cash payout' ? 'Estimated gross proceeds' : 'Estimated metal value'}</span><strong>{formatPaise(quote.grossPaise)}</strong></div>
            <div><span>Demo delivery charges</span><strong>{formatPaise(quote.deliveryChargePaise)}</strong></div>
            <div><span>Demo taxes</span><strong>{formatPaise(quote.taxPaise)}</strong></div>
            <div className="quote-total"><span>{mode === 'Cash payout' ? 'Estimated net payout' : 'Estimated total'}</span><strong>{formatPaise(quote.totalPaise)}</strong></div>
          </div>}
          {quoteError && <p className="form-feedback" role="alert">{quoteError}</p>}
          {formError && <p className="form-feedback" role="alert">{formError}</p>}
          <div className="form-actions"><button type="button" className="button button-secondary" onClick={() => setFormOpen(false)}>Cancel</button><button type="submit" className="button button-primary">Create demo request</button></div>
        </form>
      </Modal>
      <Modal open={Boolean(detail)} onClose={() => setDetailsId('')} title={detail?.id ?? 'Redemption details'} description="Fulfillment history and sample tracking">
        {detail && <><div className="redemption-detail-summary"><div><strong>{detail.customer}</strong><span>{detail.metal} · {detail.quantity} g · {formatCurrency(detail.amount)}</span></div><StatusBadge status={detail.status} /></div><dl className="redemption-address"><dt>{detail.mode === 'Coin delivery' ? 'Delivery address' : 'Payout destination'}</dt><dd>{detail.address}</dd><dt>Tracking reference</dt><dd>{detail.tracking}</dd></dl><StatusTimeline items={detail.timeline} />{statusAction(detail) && <div className="form-actions"><button className="button button-primary" onClick={() => openAction(detail, statusAction(detail).status)}>{statusAction(detail).label}</button></div>}</>}
      </Modal>
      <ConfirmDialog open={Boolean(confirmation)} title={`${confirmation?.label} (simulated)?`} description={`This will update ${confirmation?.item.id} in this demo session only.`} confirmLabel={confirmation?.label} destructive={confirmation?.status === 'Rejected'} onCancel={() => setConfirmation(null)} onConfirm={() => { updateRedemption(confirmation.item.id, confirmation.status); setOperationNotice(`${confirmation.label} for ${confirmation.item.id} updated in demo state only.`); setConfirmation(null); }} />
    </>
  );
}
