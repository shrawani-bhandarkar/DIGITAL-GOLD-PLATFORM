import { useEffect, useMemo, useState } from 'react';
import { Gem, Pencil, Plus, Search } from 'lucide-react';
import DataTable from '../components/DataTable.jsx';
import PageHeader from '../components/PageHeader.jsx';
import Pagination from '../components/Pagination.jsx';
import Modal from '../components/Modal.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { useManagement } from '../context/ManagementContext.jsx';
import { formatCurrency } from '../utils/formatters.js';
import { parseMoneyPaise, parseQuantityMilliGrams } from '../utils/financial.js';
import useDocumentTitle from '../hooks/useDocumentTitle.js';

const PAGE_SIZE = 7;
const EMPTY_PRODUCT = {
  name: '', metal: 'Gold', purity: '', unit: 'gram', buyRate: '', sellRate: '', minOrder: '', maxOrder: '', status: 'Active',
  buyChargeBps: 0, buyTaxBps: 0, sellChargeBps: 0, sellTaxBps: 0,
  minBuyQuantity: '', maxBuyQuantity: '', minSellQuantity: '', maxSellQuantity: '',
  redemptionEnabled: false, allowCoinDelivery: false, allowCashPayout: false,
  minRedemptionQuantity: '', maxRedemptionQuantity: '', redemptionChargePaise: 0, redemptionTaxBps: 0,
};

export default function MetalProductsPage() {
  useDocumentTitle('Metal products');
  const { products, saveProduct, toggleProduct } = useManagement();
  const [query, setQuery] = useState('');
  const [metalFilter, setMetalFilter] = useState('All metals');
  const [statusFilter, setStatusFilter] = useState('All statuses');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [productForm, setProductForm] = useState(EMPTY_PRODUCT);
  const [formError, setFormError] = useState('');
  const [confirmProduct, setConfirmProduct] = useState(null);

  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return products.filter((product) => (
      [product.id, product.name, product.metal, product.purity].some((value) => value.toLowerCase().includes(normalized))
      && (metalFilter === 'All metals' || product.metal === metalFilter)
      && (statusFilter === 'All statuses' || product.status === statusFilter)
    ));
  }, [products, query, metalFilter, statusFilter]);
  const visibleProducts = filteredProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  function openForm(product) {
    setProductForm(product ? { ...product } : { ...EMPTY_PRODUCT });
    setFormError('');
    setFormOpen(true);
  }

  function saveProductForm(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const values = Object.fromEntries(formData.entries());
    const buyRate = Number(values.buyRate);
    const sellRate = Number(values.sellRate);
    const minOrder = Number(values.minOrder);
    const maxOrder = Number(values.maxOrder);
    const buyChargeBps = Number(values.buyChargeBps);
    const buyTaxBps = Number(values.buyTaxBps);
    const sellChargeBps = Number(values.sellChargeBps);
    const sellTaxBps = Number(values.sellTaxBps);
    const redemptionTaxBps = Number(values.redemptionTaxBps);
    if (![buyRate, sellRate, minOrder, maxOrder].every(Number.isFinite) || buyRate <= 0 || sellRate <= 0 || sellRate >= buyRate) {
      setFormError('Enter positive rates, with the customer sell rate lower than the buy rate.');
      return;
    }
    if (minOrder <= 0 || maxOrder < minOrder) {
      setFormError('Maximum order amount must be greater than or equal to the positive minimum.');
      return;
    }
    if (![buyChargeBps, buyTaxBps, sellChargeBps, sellTaxBps, redemptionTaxBps].every((value) => Number.isSafeInteger(value) && value >= 0)) {
      setFormError('Charges and tax rates must be non-negative whole basis points.');
      return;
    }
    const quantityBounds = [
      ['Minimum buy quantity', values.minBuyQuantity, values.maxBuyQuantity],
      ['Minimum sell quantity', values.minSellQuantity, values.maxSellQuantity],
      ['Minimum redemption quantity', values.minRedemptionQuantity, values.maxRedemptionQuantity],
    ];
    try {
      for (const [label, minimum, maximum] of quantityBounds) {
        const minimumMg = minimum ? parseQuantityMilliGrams(minimum, label) : null;
        const maximumMg = maximum ? parseQuantityMilliGrams(maximum, label.replace('Minimum', 'Maximum')) : null;
        if (minimumMg !== null && maximumMg !== null && minimumMg > maximumMg) {
          throw new RangeError(`${label} cannot exceed its maximum quantity.`);
        }
      }
      parseMoneyPaise(values.redemptionCharge, 'Redemption charge', true);
    } catch (error) {
      setFormError(error.message);
      return;
    }
    const redemptionEnabled = values.redemptionEnabled === 'on';
    const allowCoinDelivery = redemptionEnabled && values.allowCoinDelivery === 'on';
    const allowCashPayout = redemptionEnabled && values.allowCashPayout === 'on';
    if (redemptionEnabled && (!allowCoinDelivery && !allowCashPayout || !values.minRedemptionQuantity || !values.maxRedemptionQuantity)) {
      setFormError('Enabled redemption needs at least one fulfillment method and configured minimum and maximum quantities.');
      return;
    }
    const name = values.name.trim();
    if (products.some((product) => product.name.toLowerCase() === name.toLowerCase() && product.id !== productForm.id)) {
      setFormError('A product with this name already exists.');
      return;
    }
    saveProduct({
      id: productForm.id ?? `MET-${String(Date.now()).slice(-5)}`,
      ...values, name, purity: values.purity.trim(),
      buyRate, sellRate, minOrder, maxOrder, buyChargeBps, buyTaxBps, sellChargeBps, sellTaxBps, redemptionTaxBps,
      minBuyQuantity: values.minBuyQuantity.trim(), maxBuyQuantity: values.maxBuyQuantity.trim(),
      minSellQuantity: values.minSellQuantity.trim(), maxSellQuantity: values.maxSellQuantity.trim(),
      redemptionEnabled, allowCoinDelivery, allowCashPayout,
      minRedemptionQuantity: String(values.minRedemptionQuantity ?? '').trim(), maxRedemptionQuantity: String(values.maxRedemptionQuantity ?? '').trim(),
      redemptionChargePaise: parseMoneyPaise(values.redemptionCharge, 'Redemption charge', true),
      status: productForm.status ?? 'Active',
    });
    setPage(1);
    setFormOpen(false);
  }

  const columns = [
    { key: 'name', label: 'Metal product', render: (value, row) => <div className="product-name-cell"><span className={`metal-icon ${row.metal.toLowerCase()}`}><Gem size={17} /></span><span><strong>{value}</strong><small>{row.id} · {row.purity} purity</small></span></div> },
    { key: 'metal', label: 'Metal' },
    { key: 'buyRate', label: 'Buy / gram', align: 'right', render: (value) => formatCurrency(value) },
    { key: 'sellRate', label: 'Sell / gram', align: 'right', render: (value) => formatCurrency(value) },
    { key: 'minOrder', label: 'Order range', align: 'right', render: (value, row) => <span>{formatCurrency(value)}–{formatCurrency(row.maxOrder)}</span> },
    { key: 'status', label: 'Status', render: (value) => <StatusBadge status={value} /> },
    { key: 'actions', label: 'Actions', render: (_, row) => <div className="table-row-actions"><button className="table-action-link" onClick={() => openForm(row)} aria-label={`Edit ${row.name}`}><Pencil size={14} /></button><button className="text-action" onClick={() => setConfirmProduct(row)}>{row.status === 'Active' ? 'Deactivate' : 'Activate'}</button></div> },
  ];

  return (
    <>
      <PageHeader eyebrow="CATALOG & PRICING" title="Metal products" description="Configure Gold, Silver, Platinum, per-product rates, charges, quantity limits, and redemption rules." actions={<button className="button button-primary" onClick={() => openForm()}><Plus size={15} /> Add product</button>} />
      <div className="demo-data-banner"><span className="demo-data-pulse" /><strong>DEMO DATA</strong><span>Rates and rule values are editable demo placeholders, not approved platform policy. No trades are executed.</span></div>
      <section className="management-stat-grid">
        <article><span className="management-stat-icon stat-icon-teal"><Gem size={17} /></span><div><span>Total products</span><strong>{products.length}</strong></div></article>
        <article><span className="management-stat-icon stat-icon-blue"><span className="stat-mini-dot" /></span><div><span>Active products</span><strong>{products.filter((product) => product.status === 'Active').length}</strong></div></article>
        <article><span className="management-stat-icon stat-icon-amber"><span className="stat-mini-dot" /></span><div><span>Metals supported</span><strong>{new Set(products.map((product) => product.metal)).size}</strong></div></article>
      </section>
      <section className="panel management-panel">
        <div className="management-toolbar">
          <label className="management-search"><Search size={16} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search products, metal or purity" aria-label="Search products" /></label>
          <div className="management-filters">
            <select value={metalFilter} onChange={(event) => { setMetalFilter(event.target.value); setPage(1); }} aria-label="Filter by metal"><option>All metals</option>{[...new Set(products.map((product) => product.metal))].map((metal) => <option key={metal}>{metal}</option>)}</select>
            <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} aria-label="Filter by status"><option>All statuses</option><option>Active</option><option>Inactive</option></select>
          </div>
        </div>
        <DataTable columns={columns} rows={visibleProducts} allRows={filteredProducts} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} rowKey="id" />
        <Pagination page={page} pageSize={PAGE_SIZE} total={filteredProducts.length} onPageChange={setPage} />
      </section>
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={productForm.id ? 'Edit metal product' : 'Add metal product'} description="Set product details and customer order limits." size="large">
        <form className="management-form" onSubmit={saveProductForm}>
          <div className="form-grid">
            <label className="field-block form-grid-full"><span>Product name</span><input name="name" required minLength="3" maxLength="80" value={productForm.name} onChange={(event) => setProductForm({ ...productForm, name: event.target.value })} placeholder="e.g. 24K Digital Gold" /></label>
            <label className="field-block"><span>Metal</span><select name="metal" value={productForm.metal} onChange={(event) => setProductForm({ ...productForm, metal: event.target.value })}><option>Gold</option><option>Silver</option><option>Platinum</option></select></label>
            <label className="field-block"><span>Purity (fineness)</span><input name="purity" required pattern="[0-9]{3}(\.[0-9]{1,2})?" title="Enter a fineness such as 999.9" value={productForm.purity} onChange={(event) => setProductForm({ ...productForm, purity: event.target.value })} placeholder="999.9" /></label>
            <label className="field-block"><span>Buy rate / gram (₹)</span><input name="buyRate" type="number" min="0.01" step="0.01" required value={productForm.buyRate} onChange={(event) => setProductForm({ ...productForm, buyRate: event.target.value })} /></label>
            <label className="field-block"><span>Sell rate / gram (₹)</span><input name="sellRate" type="number" min="0.01" step="0.01" required value={productForm.sellRate} onChange={(event) => setProductForm({ ...productForm, sellRate: event.target.value })} /></label>
            <label className="field-block"><span>Minimum order (₹)</span><input name="minOrder" type="number" min="0.01" step="0.01" required value={productForm.minOrder} onChange={(event) => setProductForm({ ...productForm, minOrder: event.target.value })} /></label>
            <label className="field-block"><span>Maximum order (₹)</span><input name="maxOrder" type="number" min="0.01" step="0.01" required value={productForm.maxOrder} onChange={(event) => setProductForm({ ...productForm, maxOrder: event.target.value })} /></label>
          </div>
          <div className="product-rule-config">
            <h3>Per-product demo charges and taxes</h3>
            <p>Rates are basis points (100 bps = 1%). These independent demo values are not approved tax or fee policy.</p>
            <div className="form-grid">
              <label className="field-block"><span>Buy charge (bps)</span><input name="buyChargeBps" type="number" min="0" step="1" required value={productForm.buyChargeBps ?? 0} onChange={(event) => setProductForm({ ...productForm, buyChargeBps: event.target.value })} /></label>
              <label className="field-block"><span>Buy tax on charge (bps)</span><input name="buyTaxBps" type="number" min="0" step="1" required value={productForm.buyTaxBps ?? 0} onChange={(event) => setProductForm({ ...productForm, buyTaxBps: event.target.value })} /></label>
              <label className="field-block"><span>Sell charge (bps)</span><input name="sellChargeBps" type="number" min="0" step="1" required value={productForm.sellChargeBps ?? 0} onChange={(event) => setProductForm({ ...productForm, sellChargeBps: event.target.value })} /></label>
              <label className="field-block"><span>Sell tax on charge (bps)</span><input name="sellTaxBps" type="number" min="0" step="1" required value={productForm.sellTaxBps ?? 0} onChange={(event) => setProductForm({ ...productForm, sellTaxBps: event.target.value })} /></label>
            </div>
          </div>
          <div className="product-rule-config">
            <h3>Quantity limits (grams)</h3>
            <p>Leave blank when a limit has not been supplied. Values are independently configurable for each product.</p>
            <div className="form-grid">
              <label className="field-block"><span>Minimum buy quantity</span><input name="minBuyQuantity" type="number" min="0.001" step="0.001" value={productForm.minBuyQuantity ?? ''} onChange={(event) => setProductForm({ ...productForm, minBuyQuantity: event.target.value })} /></label>
              <label className="field-block"><span>Maximum buy quantity</span><input name="maxBuyQuantity" type="number" min="0.001" step="0.001" value={productForm.maxBuyQuantity ?? ''} onChange={(event) => setProductForm({ ...productForm, maxBuyQuantity: event.target.value })} /></label>
              <label className="field-block"><span>Minimum sell quantity</span><input name="minSellQuantity" type="number" min="0.001" step="0.001" value={productForm.minSellQuantity ?? ''} onChange={(event) => setProductForm({ ...productForm, minSellQuantity: event.target.value })} /></label>
              <label className="field-block"><span>Maximum sell quantity</span><input name="maxSellQuantity" type="number" min="0.001" step="0.001" value={productForm.maxSellQuantity ?? ''} onChange={(event) => setProductForm({ ...productForm, maxSellQuantity: event.target.value })} /></label>
            </div>
          </div>
          <div className="product-rule-config">
            <h3>Redemption settings</h3>
            <div className="form-check-row"><label><input name="redemptionEnabled" type="checkbox" checked={Boolean(productForm.redemptionEnabled)} onChange={(event) => setProductForm({ ...productForm, redemptionEnabled: event.target.checked })} /> Enable redemption</label></div>
            <div className="form-grid">
              <label className="field-block"><span>Minimum redemption quantity (g)</span><input name="minRedemptionQuantity" type="number" min="0.001" step="0.001" required={Boolean(productForm.redemptionEnabled)} disabled={!productForm.redemptionEnabled} value={productForm.minRedemptionQuantity ?? ''} onChange={(event) => setProductForm({ ...productForm, minRedemptionQuantity: event.target.value })} /></label>
              <label className="field-block"><span>Maximum redemption quantity (g)</span><input name="maxRedemptionQuantity" type="number" min="0.001" step="0.001" required={Boolean(productForm.redemptionEnabled)} disabled={!productForm.redemptionEnabled} value={productForm.maxRedemptionQuantity ?? ''} onChange={(event) => setProductForm({ ...productForm, maxRedemptionQuantity: event.target.value })} /></label>
              <label className="field-block"><span>Delivery charge (₹)</span><input name="redemptionCharge" type="number" min="0" step="0.01" required value={(productForm.redemptionChargePaise ?? 0) / 100} onChange={(event) => setProductForm({ ...productForm, redemptionChargePaise: Math.round(Number(event.target.value || 0) * 100) })} /></label>
              <label className="field-block"><span>Tax on delivery charge (bps)</span><input name="redemptionTaxBps" type="number" min="0" step="1" required value={productForm.redemptionTaxBps ?? 0} onChange={(event) => setProductForm({ ...productForm, redemptionTaxBps: event.target.value })} /></label>
              <div className="form-check-row form-grid-full"><label><input name="allowCoinDelivery" type="checkbox" checked={Boolean(productForm.allowCoinDelivery)} disabled={!productForm.redemptionEnabled} onChange={(event) => setProductForm({ ...productForm, allowCoinDelivery: event.target.checked })} /> Allow coin delivery</label><label><input name="allowCashPayout" type="checkbox" checked={Boolean(productForm.allowCashPayout)} disabled={!productForm.redemptionEnabled} onChange={(event) => setProductForm({ ...productForm, allowCashPayout: event.target.checked })} /> Allow cash payout</label></div>
            </div>
          </div>
          {formError && <p className="form-feedback" role="alert">{formError}</p>}
          <div className="form-actions"><button type="button" className="button button-secondary" onClick={() => setFormOpen(false)}>Cancel</button><button type="submit" className="button button-primary">Save product</button></div>
        </form>
      </Modal>
      <ConfirmDialog open={Boolean(confirmProduct)} title={`${confirmProduct?.status === 'Active' ? 'Deactivate' : 'Activate'} product?`} description={`${confirmProduct?.name} will be ${confirmProduct?.status === 'Active' ? 'hidden from' : 'available in'} the demo catalog.`} confirmLabel={confirmProduct?.status === 'Active' ? 'Deactivate' : 'Activate'} destructive={confirmProduct?.status === 'Active'} onCancel={() => setConfirmProduct(null)} onConfirm={() => { toggleProduct(confirmProduct.id); setConfirmProduct(null); }} />
    </>
  );
}
