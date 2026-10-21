import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, Plus, Search } from 'lucide-react';
import DataTable from '../components/DataTable.jsx';
import PageHeader from '../components/PageHeader.jsx';
import Pagination from '../components/Pagination.jsx';
import Modal from '../components/Modal.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import SimulatedBanner from '../components/SimulatedBanner.jsx';
import { useManagement } from '../context/ManagementContext.jsx';
import { useOperations } from '../context/OperationsContext.jsx';
import { formatCurrency } from '../utils/formatters.js';
import { assertQuantityWithinConfiguredLimits, calculateBuyQuote, calculatePortfolio, calculateSellQuote, formatGrams, formatPaise, productFeePolicy } from '../utils/financial.js';
import useDocumentTitle from '../hooks/useDocumentTitle.js';

const PAGE_SIZE = 7;

export default function OrdersPage() {
  useDocumentTitle('Buy & sell orders');
  const { customers, products, metalMakingCharges, ledgerEntries } = useManagement();
  const { orders, redemptions, addOrder } = useOperations();
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('All types');
  const [statusFilter, setStatusFilter] = useState('All statuses');
  const [metalFilter, setMetalFilter] = useState('All metals');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [orderType, setOrderType] = useState('Buy');
  const [formError, setFormError] = useState('');
  const [basis, setBasis] = useState('amount');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [enteredValue, setEnteredValue] = useState('');

  const selectedProduct = products.find((item) => item.id === selectedProductId && item.status === 'Active');
  const selectedMakingCharge = metalMakingCharges.find((item) => item.metal === selectedProduct?.metal);
  const portfolio = calculatePortfolio(ledgerEntries);
  const availableMilliGrams = portfolio.find((holding) => holding.customerId === selectedCustomerId && holding.productId === selectedProductId)?.availableMilliGrams ?? 0;
  let quote = null;
  let quoteError = '';
  if (selectedProduct && enteredValue) {
    try {
      if (orderType === 'Buy' && !selectedMakingCharge) {
        throw new RangeError(`No making charge configuration is available for ${selectedProduct.metal}.`);
      }
      quote = orderType === 'Buy'
        ? calculateBuyQuote({
          basis,
          value: enteredValue,
          ratePerGram: selectedProduct.buyRate,
          feePolicy: productFeePolicy(selectedProduct),
          makingChargePerGramPaise: selectedMakingCharge.chargePerGramPaise,
          makingChargeEnabled: selectedMakingCharge.enabled,
        })
        : calculateSellQuote({ quantity: enteredValue, ratePerGram: selectedProduct.sellRate, feePolicy: productFeePolicy(selectedProduct) });
      assertQuantityWithinConfiguredLimits(quote.quantityMilliGrams, {
        minimum: orderType === 'Buy' ? selectedProduct.minBuyQuantity : selectedProduct.minSellQuantity,
        maximum: orderType === 'Buy' ? selectedProduct.maxBuyQuantity : selectedProduct.maxSellQuantity,
        label: orderType === 'Buy' ? 'Buy quantity' : 'Sell quantity',
      });
      if (orderType === 'Sell' && quote.quantityMilliGrams > availableMilliGrams) {
        quoteError = `Sell quantity cannot exceed the available ${formatGrams(availableMilliGrams)}.`;
      } else if (orderType === 'Buy' && (quote.baseAmountPaise / 100 < selectedProduct.minOrder || quote.baseAmountPaise / 100 > selectedProduct.maxOrder)) {
        quoteError = `Base purchase amount must be between ${formatCurrency(selectedProduct.minOrder)} and ${formatCurrency(selectedProduct.maxOrder)}.`;
      }
    } catch (error) {
      quoteError = error.message;
    }
  }

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return orders.filter((order) => (
      [order.id, order.customer, order.customerId, order.metal].some((value) => value.toLowerCase().includes(term))
      && (typeFilter === 'All types' || order.type === typeFilter)
      && (statusFilter === 'All statuses' || order.status === statusFilter)
      && (metalFilter === 'All metals' || order.metal === metalFilter)
    ));
  }, [orders, query, typeFilter, statusFilter, metalFilter]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  async function submitOrder(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const customer = customers.find((item) => item.id === data.customerId);
    const product = products.find((item) => item.id === data.productId && item.status === 'Active');
    if (!customer || !product) {
      setFormError('Select a customer and an active metal product.');
      return;
    }
    let calculation;
    const makingCharge = metalMakingCharges.find((item) => item.metal === product.metal);
    try {
      if (orderType === 'Buy' && !makingCharge) {
        throw new RangeError(`No making charge configuration is available for ${product.metal}.`);
      }
      calculation = orderType === 'Buy'
        ? calculateBuyQuote({
          basis,
          value: basis === 'amount' ? data.amount : data.quantity,
          ratePerGram: product.buyRate,
          feePolicy: productFeePolicy(product),
          makingChargePerGramPaise: makingCharge.chargePerGramPaise,
          makingChargeEnabled: makingCharge.enabled,
        })
        : calculateSellQuote({ quantity: data.quantity, ratePerGram: product.sellRate, feePolicy: productFeePolicy(product) });
      assertQuantityWithinConfiguredLimits(calculation.quantityMilliGrams, {
        minimum: orderType === 'Buy' ? product.minBuyQuantity : product.minSellQuantity,
        maximum: orderType === 'Buy' ? product.maxBuyQuantity : product.maxSellQuantity,
        label: orderType === 'Buy' ? 'Buy quantity' : 'Sell quantity',
      });
    } catch (error) {
      setFormError(error.message);
      return;
    }
    if (orderType === 'Buy' && (calculation.baseAmountPaise / 100 < product.minOrder || calculation.baseAmountPaise / 100 > product.maxOrder)) {
      setFormError(`Base purchase amount must be between ${formatCurrency(product.minOrder)} and ${formatCurrency(product.maxOrder)}.`);
      return;
    }
    if (orderType === 'Sell') {
      const latestLedger = calculatePortfolio(ledgerEntries);
      const latestAvailable = latestLedger.find((holding) => holding.customerId === customer.id && holding.productId === product.id)?.availableMilliGrams ?? 0;
      if (calculation.quantityMilliGrams > latestAvailable) {
        setFormError(`Sell quantity cannot exceed the available ${formatGrams(latestAvailable)}.`);
        return;
      }
    }
    const rate = orderType === 'Buy' ? product.buyRate : product.sellRate;
    const baseAmountPaise = orderType === 'Buy' ? calculation.baseAmountPaise : calculation.grossPaise;
    const chargePaise = calculation.chargePaise;
    const taxPaise = calculation.taxPaise;
    const totalPaise = orderType === 'Buy' ? calculation.totalPaise : calculation.netPaise;
    const saved = await addOrder({
      id: `ORD-2026-${String(Date.now()).slice(-5)}`, customerId: customer.id, productId: product.id,
      customer: customer.name, type: orderType, metal: product.metal, purity: product.purity,
      quantity: calculation.quantityMilliGrams / 1000, amount: totalPaise / 100, baseAmount: baseAmountPaise / 100,
      charges: chargePaise / 100, taxes: taxPaise / 100, rate, payment: data.payment,
      makingCharges: orderType === 'Buy' ? calculation.makingChargePaise / 100 : 0,
      makingChargePerGram: orderType === 'Buy' ? makingCharge.chargePerGramPaise / 100 : 0,
      makingChargeEnabled: orderType === 'Buy' && makingCharge.enabled,
      purchaseSubtotal: orderType === 'Buy' ? calculation.purchaseSubtotalPaise / 100 : undefined,
      status: 'Pending', placedAt: '15 Oct 2026, just now',
      timeline: [{ label: `${orderType} order created (simulated)`, time: '15 Oct, just now', done: true }, { label: 'Payment and fulfillment', time: 'Awaiting processing', done: false }],
    });
    if (!saved) { setFormError('Could not save the order. Check the database connection and try again.'); return; }
    setPage(1);
    setFormOpen(false);
    setFormError('');
    setEnteredValue('');
    setSelectedCustomerId('');
    setSelectedProductId('');
  }

  const columns = [
    { key: 'id', label: 'Order', render: (value, row) => <Link className="order-link-cell" to={`/orders/${row.id}`}><span className={`transaction-type-icon ${row.type.toLowerCase()}`}>{row.type === 'Buy' ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}</span><span><strong>{value}</strong><small>{row.placedAt}</small></span></Link> },
    { key: 'customer', label: 'Customer', render: (value, row) => <div className="management-secondary"><strong>{value}</strong><small>{row.customerId}</small></div> },
    { key: 'type', label: 'Side', render: (value, row) => <span className={`order-type type-${value.toLowerCase()}`}>{value} {row.metal}</span> },
    { key: 'quantity', label: 'Quantity', align: 'right', render: (value) => `${value} g` },
    { key: 'amount', label: 'Amount', align: 'right', render: (value) => <strong>{formatCurrency(value)}</strong> },
    { key: 'status', label: 'Status', render: (value) => <StatusBadge status={value} /> },
    { key: 'detail', label: '', render: (_, row) => <Link to={`/orders/${row.id}`} className="table-action-link" aria-label={`View order ${row.id}`}>View</Link> },
  ];

  return (
    <>
      <PageHeader eyebrow="TRANSACTION OPERATIONS" title="Buy & sell orders" description="Review persisted customer orders, pending payments, and metal ledger status." actions={<div className="page-action-pair"><button className="button button-secondary" onClick={() => { setOrderType('Sell'); setBasis('quantity'); setEnteredValue(''); setSelectedCustomerId(''); setSelectedProductId(''); setFormError(''); setFormOpen(true); }}><ArrowUpRight size={15} /> New sell</button><button className="button button-primary" onClick={() => { setOrderType('Buy'); setBasis('amount'); setEnteredValue(''); setSelectedCustomerId(''); setSelectedProductId(''); setFormError(''); setFormOpen(true); }}><Plus size={15} /> New buy</button></div>} />
      <SimulatedBanner>Orders and payment intents are stored in MySQL. No gateway capture, payout, or custody movement is connected.</SimulatedBanner>
      <section className="management-stat-grid">
        <article><span className="management-stat-icon stat-icon-teal"><ArrowDownLeft size={17} /></span><div><span>Total orders</span><strong>{orders.length}</strong></div></article>
        <article><span className="management-stat-icon stat-icon-amber"><span className="stat-mini-dot" /></span><div><span>Awaiting processing</span><strong>{orders.filter((item) => item.status === 'Pending' || item.status === 'Processing').length}</strong></div></article>
        <article><span className="management-stat-icon stat-icon-blue"><ArrowUpRight size={17} /></span><div><span>Buy / sell today</span><strong>{orders.filter((item) => item.placedAt.startsWith('15 Oct')).length}</strong></div></article>
      </section>
      <section className="panel management-panel">
        <div className="management-toolbar">
          <label className="management-search"><Search size={16} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search order, customer or ID" aria-label="Search orders" /></label>
          <div className="management-filters">
            <select value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); setPage(1); }} aria-label="Filter order side"><option>All types</option><option>Buy</option><option>Sell</option></select>
            <select value={metalFilter} onChange={(event) => { setMetalFilter(event.target.value); setPage(1); }} aria-label="Filter metal"><option>All metals</option>{[...new Set(orders.map((item) => item.metal))].map((metal) => <option key={metal}>{metal}</option>)}</select>
            <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} aria-label="Filter order status"><option>All statuses</option><option>Pending</option><option>Processing</option><option>Completed</option><option>Failed</option><option>Cancelled</option></select>
          </div>
        </div>
        <DataTable columns={columns} rows={pageRows} allRows={filtered} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
        <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
      </section>
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={`Create ${orderType.toLowerCase()} order`} description="Creates a stored order and pending payment intent. External payment and custody actions are not connected.">
        <form className="management-form" onSubmit={submitOrder}>
          <div className="form-grid">
            <label className="field-block form-grid-full"><span>Customer</span><select name="customerId" required value={selectedCustomerId} onChange={(event) => setSelectedCustomerId(event.target.value)}><option value="" disabled>Select a customer</option>{customers.filter((customer) => customer.status === 'Active').map((customer) => <option value={customer.id} key={customer.id}>{customer.name} · {customer.id}</option>)}</select></label>
            <label className="field-block form-grid-full"><span>Active metal product</span><select name="productId" required value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)}><option value="" disabled>Select a product</option>{products.filter((product) => product.status === 'Active').map((product) => <option value={product.id} key={product.id}>{product.name} · {product.purity}</option>)}</select></label>
            {orderType === 'Buy' && <label className="field-block"><span>Purchase basis</span><select value={basis} onChange={(event) => { setBasis(event.target.value); setEnteredValue(''); }}><option value="amount">Amount in rupees</option><option value="quantity">Quantity in grams</option></select></label>}
            {orderType === 'Buy' && basis === 'amount'
              ? <label className="field-block"><span>Purchase amount (₹)</span><input name="amount" type="number" min="0.01" step="0.01" required value={enteredValue} onChange={(event) => setEnteredValue(event.target.value)} placeholder="5000" /></label>
              : <label className="field-block"><span>Quantity (grams)</span><input name="quantity" type="number" min={orderType === 'Buy' ? selectedProduct?.minBuyQuantity || '0.001' : selectedProduct?.minSellQuantity || '0.001'} max={orderType === 'Sell' ? Math.min(selectedProduct?.maxSellQuantity ? Number(selectedProduct.maxSellQuantity) : Number.POSITIVE_INFINITY, availableMilliGrams / 1000) : selectedProduct?.maxBuyQuantity || undefined} step="0.001" required value={enteredValue} onChange={(event) => setEnteredValue(event.target.value)} placeholder="1.000" /></label>}
            <label className="field-block"><span>Payment method</span><select name="payment" required defaultValue=""><option value="" disabled>Select method</option><option>UPI</option><option>Card</option><option>Net banking</option><option>Wallet</option></select></label>
          </div>
          {orderType === 'Sell' && selectedCustomerId && selectedProductId && <p className="form-help">Available to sell: {formatGrams(availableMilliGrams)} · Sample ledger only.</p>}
          {quote && !quoteError && <div className="quote-breakdown" role="region" aria-label="Estimated order breakdown">
            {orderType === 'Buy' ? (
              <>
                <div><span>Metal rate / gram</span><strong>{formatCurrency(selectedProduct.buyRate)}</strong></div>
                <div><span>Weight</span><strong>{formatGrams(quote.quantityMilliGrams)}</strong></div>
                <div><span>Metal value</span><strong>{formatPaise(quote.baseAmountPaise)}</strong></div>
                <div><span>Making charge / gram</span><strong>{formatCurrency(selectedMakingCharge.chargePerGramPaise / 100)}{selectedMakingCharge.enabled ? '' : ' · disabled'}</strong></div>
                <div><span>Total making charges</span><strong>{formatPaise(quote.makingChargePaise)}</strong></div>
                <div className="quote-total"><span>Purchase subtotal</span><strong>{formatPaise(quote.purchaseSubtotalPaise)}</strong></div>
                <div><span>Other demo charges</span><strong>{formatPaise(quote.chargePaise)}</strong></div>
                <div><span>Configured demo taxes</span><strong>{formatPaise(quote.taxPaise)}</strong></div>
                <div className="quote-total"><span>Estimated quantity</span><strong>{formatGrams(quote.quantityMilliGrams)}</strong></div>
                <div className="quote-total"><span>Estimated final payable</span><strong>{formatPaise(quote.totalPaise)}</strong></div>
              </>
            ) : (
              <>
                <div><span>Gross proceeds</span><strong>{formatPaise(quote.grossPaise)}</strong></div>
                <div><span>Demo selling charges</span><strong>{formatPaise(quote.chargePaise)}</strong></div>
                <div><span>Configured demo taxes</span><strong>{formatPaise(quote.taxPaise)}</strong></div>
                <div className="quote-total"><span>Estimated net proceeds</span><strong>{formatPaise(quote.netPaise)}</strong></div>
              </>
            )}
          </div>}
          {quoteError && <p className="form-feedback" role="alert">{quoteError}</p>}
          {formError && <p className="form-feedback" role="alert">{formError}</p>}
          <div className="form-actions"><button type="button" className="button button-secondary" onClick={() => setFormOpen(false)}>Cancel</button><button type="submit" className="button button-primary">Create demo order</button></div>
        </form>
      </Modal>
    </>
  );
}
