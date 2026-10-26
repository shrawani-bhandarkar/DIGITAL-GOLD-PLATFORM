import { useEffect, useMemo, useState } from 'react';
import { Gem, Pencil, Plus, Search } from 'lucide-react';
import DataTable from '../components/DataTable.jsx';
import PageHeader from '../components/PageHeader.jsx';
import Pagination from '../components/Pagination.jsx';
import Modal from '../components/Modal.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { useManagement } from '../context/ManagementContext.jsx';
import { useAdmin } from '../context/AdminContext.jsx';
import { formatCurrency } from '../utils/formatters.js';
import { parseMoneyAmount, parseQuantityMilliGrams } from '../utils/financial.js';
import useDocumentTitle from '../hooks/useDocumentTitle.js';

const PAGE_SIZE = 7;
const INDIAN_STATES = [
  ['AN', 'Andaman and Nicobar Islands'], ['AP', 'Andhra Pradesh'], ['AR', 'Arunachal Pradesh'], ['AS', 'Assam'],
  ['BR', 'Bihar'], ['CH', 'Chandigarh'], ['CT', 'Chhattisgarh'], ['DN', 'Dadra and Nagar Haveli and Daman and Diu'],
  ['DL', 'Delhi'], ['GA', 'Goa'], ['GJ', 'Gujarat'], ['HR', 'Haryana'], ['HP', 'Himachal Pradesh'],
  ['DD', 'Daman and Diu (legacy UT code)'], ['JK', 'Jammu and Kashmir'], ['JH', 'Jharkhand'], ['KA', 'Karnataka'], ['KL', 'Kerala'], ['LA', 'Ladakh'],
  ['LD', 'Lakshadweep'], ['MP', 'Madhya Pradesh'], ['MH', 'Maharashtra'], ['MN', 'Manipur'], ['ML', 'Meghalaya'],
  ['MZ', 'Mizoram'], ['NL', 'Nagaland'], ['OR', 'Odisha'], ['PY', 'Puducherry'], ['PB', 'Punjab'],
  ['RJ', 'Rajasthan'], ['SK', 'Sikkim'], ['TN', 'Tamil Nadu'], ['TG', 'Telangana'], ['TR', 'Tripura'],
  ['UP', 'Uttar Pradesh'], ['UT', 'Uttarakhand'], ['WB', 'West Bengal'],
];
const EMPTY_PRODUCT = {
  name: '', metal: 'Gold', purity: '', unit: 'gram', buyRate: '', sellRate: '', minOrder: '', maxOrder: '', status: 'Active',
  buyChargeBps: 0, buyTaxBps: 0, sellChargeBps: 0, sellTaxBps: 0,
  minBuyQuantity: '', maxBuyQuantity: '', minSellQuantity: '', maxSellQuantity: '',
  redemptionEnabled: false, allowCoinDelivery: false, allowCashPayout: false,
  minRedemptionQuantity: '', maxRedemptionQuantity: '', redemptionChargePaise: 0, redemptionTaxBps: 0,
};

export default function MetalProductsPage() {
  useDocumentTitle('Metal products');
  const { products, saveProduct, toggleProduct, metalMakingCharges, updateMetalMakingCharge, metalTaxSettings, updateMetalTaxSettings } = useManagement();
  const { activeRoleId, hasPermission } = useAdmin();
  const [query, setQuery] = useState('');
  const [metalFilter, setMetalFilter] = useState('All metals');
  const [statusFilter, setStatusFilter] = useState('All statuses');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [productForm, setProductForm] = useState(EMPTY_PRODUCT);
  const [formError, setFormError] = useState('');
  const [confirmProduct, setConfirmProduct] = useState(null);
  const [makingChargeForm, setMakingChargeForm] = useState(null);
  const [makingChargeValue, setMakingChargeValue] = useState('');
  const [makingChargeEnabled, setMakingChargeEnabled] = useState(false);
  const [makingChargeError, setMakingChargeError] = useState('');
  const [taxSettingsDraft, setTaxSettingsDraft] = useState({ sellerStateCode: '', cgstPercent: '', sgstPercent: '', igstPercent: '' });
  const [taxSettingsError, setTaxSettingsError] = useState('');
  const [taxSettingsNotice, setTaxSettingsNotice] = useState('');
  const canConfigureProducts = hasPermission('products');

  useEffect(() => {
    if (!metalTaxSettings) return;
    setTaxSettingsDraft({
      sellerStateCode: metalTaxSettings.sellerStateCode ?? '',
      cgstPercent: String(Number(metalTaxSettings.cgstBps) / 100),
      sgstPercent: String(Number(metalTaxSettings.sgstBps) / 100),
      igstPercent: String(Number(metalTaxSettings.igstBps) / 100),
    });
  }, [metalTaxSettings]);

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

  async function saveProductForm(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const values = Object.fromEntries(formData.entries());
    let redemptionChargePaise;
    try {
      redemptionChargePaise = parseMoneyPaise(values.redemptionCharge, 'Redemption charge', true);
    } catch (error) {
      setFormError(error.message);
      return;
    }
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
    const saved = await saveProduct({
      id: productForm.id ?? `MET-${String(Date.now()).slice(-5)}`,
      ...values, name, purity: values.purity.trim(),
      buyRate, sellRate, minOrder, maxOrder, buyChargeBps, buyTaxBps, sellChargeBps, sellTaxBps, redemptionTaxBps,
      minBuyQuantity: values.minBuyQuantity.trim(), maxBuyQuantity: values.maxBuyQuantity.trim(),
      minSellQuantity: values.minSellQuantity.trim(), maxSellQuantity: values.maxSellQuantity.trim(),
      redemptionEnabled, allowCoinDelivery, allowCashPayout,
      minRedemptionQuantity: String(values.minRedemptionQuantity ?? '').trim(), maxRedemptionQuantity: String(values.maxRedemptionQuantity ?? '').trim(),
      redemptionChargePaise,
      status: productForm.status ?? 'Active',
    });
    if (!saved) { setFormError('Could not save the product. Check the database connection and try again.'); return; }
    setPage(1);
    setFormOpen(false);
  }

  function openMakingChargeForm(config) {
    setMakingChargeForm(config);
    setMakingChargeValue(config.chargePerPurchase.toFixed(2));
    setMakingChargeEnabled(config.enabled);
    setMakingChargeError('');
  }

  async function saveMakingChargeForm(event) {
    event.preventDefault();
    let chargePerPurchase;
    try {
      chargePerPurchase = parseMoneyAmount(makingChargeValue, 'Fixed making charge per purchase', true);
    } catch (error) {
      setMakingChargeError(error.message);
      return;
    }
    const result = await updateMetalMakingCharge(makingChargeForm.metal, chargePerPurchase, makingChargeEnabled);
    if (!result.success) {
      setMakingChargeError(result.message);
      return;
    }
    setMakingChargeForm(null);
  }

  async function saveTaxSettings(event) {
    event.preventDefault();
    const rates = ['cgstPercent', 'sgstPercent', 'igstPercent'].map((key) => Number(taxSettingsDraft[key]) * 100);
    if (
      !taxSettingsDraft.sellerStateCode
      || !rates.every((rate) => Number.isSafeInteger(rate) && rate >= 0 && rate <= 10_000)
      || rates[0] !== rates[1]
      || rates[2] !== rates[0] + rates[1]
    ) {
      setTaxSettingsError('Choose the seller state; CGST and SGST must match, and IGST must equal their combined rate.');
      return;
    }
    const result = await updateMetalTaxSettings({
      sellerStateCode: taxSettingsDraft.sellerStateCode,
      cgstBps: rates[0],
      sgstBps: rates[1],
      igstBps: rates[2],
    });
    if (!result.success) {
      setTaxSettingsError(result.message);
      return;
    }
    setTaxSettingsError('');
    setTaxSettingsNotice('GST settings saved. New Quick Buy quotes use these rates immediately.');
  }

  const makingChargeColumns = [
    { key: 'metal', label: 'Metal', render: (value) => <div className="product-name-cell"><span className={`metal-icon ${value.toLowerCase()}`}><Gem size={17} /></span><strong>{value}</strong></div> },
    {
      key: 'rates',
      label: 'Customer purchase / sell-back rate per gram',
      render: (_, row) => (
        <div className="product-making-rates">
          {row.rates.map((product) => (
            <span key={product.id}>{product.purity} purchase: {formatCurrency(product.buyRate)} · sell-back: {formatCurrency(product.sellRate)}</span>
          ))}
        </div>
      ),
    },
    { key: 'chargePerPurchase', label: 'Fixed making charge / purchase', align: 'right', render: formatCurrency },
    { key: 'enabled', label: 'Status', render: (value) => <StatusBadge status={value ? 'Enabled' : 'Disabled'} /> },
    { key: 'updatedAt', label: 'Last updated' },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => activeRoleId === 'SUPER_ADMIN' || canConfigureProducts
        ? <button className="table-action-link" onClick={() => openMakingChargeForm(row)} aria-label={`Edit ${row.metal} making charge`}><Pencil size={14} /> Edit</button>
        : <span>View only</span>,
    },
  ];

  const makingChargeRows = metalMakingCharges.map((config) => ({
    ...config,
    rates: products.filter((product) => product.metal === config.metal && product.status === 'Active'),
  }));

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
      <div className="demo-data-banner"><span className="demo-data-pulse" /><strong>DATABASE</strong><span>Product rules, rates, and making charges are stored in MySQL. No trades are executed.</span></div>
      <section className="management-stat-grid">
        <article><span className="management-stat-icon stat-icon-teal"><Gem size={17} /></span><div><span>Total products</span><strong>{products.length}</strong></div></article>
        <article><span className="management-stat-icon stat-icon-blue"><span className="stat-mini-dot" /></span><div><span>Active products</span><strong>{products.filter((product) => product.status === 'Active').length}</strong></div></article>
        <article><span className="management-stat-icon stat-icon-amber"><span className="stat-mini-dot" /></span><div><span>Metals supported</span><strong>{new Set(products.map((product) => product.metal)).size}</strong></div></article>
      </section>
      <section className="panel management-panel">
        <div className="panel-heading">
          <div><h2>Metal-specific making charges</h2>          <p>Fixed making charges are configured independently for each metal and applied once per purchase.</p></div>
        </div>
        <div className="demo-data-banner"><span className="demo-data-pulse" /><strong>STORED SETTINGS</strong><span>Making charges are saved as admin configuration; customer transactions are not triggered.</span></div>
        <DataTable columns={makingChargeColumns} rows={makingChargeRows} rowKey="metal" />
      </section>
      <section className="panel management-panel">
        <div className="panel-heading">
          <div><h2>Quick Buy GST</h2><p>GST is calculated server-side on metal value, making charges, and other configured purchase charges.</p></div>
          {metalTaxSettings?.updatedAt ? <span>Updated {metalTaxSettings.updatedAt}</span> : null}
        </div>
        <form className="management-form" onSubmit={saveTaxSettings}>
          <div className="form-grid">
            <label className="field-block"><span>Seller state</span><select value={taxSettingsDraft.sellerStateCode} onChange={(event) => setTaxSettingsDraft({ ...taxSettingsDraft, sellerStateCode: event.target.value })} required disabled={!canConfigureProducts}>
              <option value="">Choose seller state</option>{INDIAN_STATES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
            </select></label>
            <label className="field-block"><span>CGST (%)</span><input type="number" min="0" max="100" step="0.01" value={taxSettingsDraft.cgstPercent} onChange={(event) => setTaxSettingsDraft({ ...taxSettingsDraft, cgstPercent: event.target.value })} required disabled={!canConfigureProducts} /></label>
            <label className="field-block"><span>SGST (%)</span><input type="number" min="0" max="100" step="0.01" value={taxSettingsDraft.sgstPercent} onChange={(event) => setTaxSettingsDraft({ ...taxSettingsDraft, sgstPercent: event.target.value })} required disabled={!canConfigureProducts} /></label>
            <label className="field-block"><span>IGST (%)</span><input type="number" min="0" max="100" step="0.01" value={taxSettingsDraft.igstPercent} onChange={(event) => setTaxSettingsDraft({ ...taxSettingsDraft, igstPercent: event.target.value })} required disabled={!canConfigureProducts} /></label>
          </div>
          <p className="muted-copy">Intra-state orders use CGST + SGST; interstate orders use IGST. Default entries follow the requested 1.5% + 1.5% split and 3% IGST. Confirm rates and tax treatment with your tax advisor before enabling sales.</p>
          {taxSettingsError ? <p className="form-feedback" role="alert">{taxSettingsError}</p> : null}
          {taxSettingsNotice ? <p className="form-feedback" role="status">{taxSettingsNotice}</p> : null}
          {canConfigureProducts ? <div className="form-actions"><button type="submit" className="button button-primary">Save GST settings</button></div> : <p className="muted-copy">View only — the products permission is required to change GST settings.</p>}
        </form>
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
      <Modal
        open={Boolean(makingChargeForm)}
        onClose={() => setMakingChargeForm(null)}
        title={`Configure ${makingChargeForm?.metal ?? ''} making charge`}
        description="This fixed amount is charged once per purchase of the selected metal."
      >
        <form className="management-form" onSubmit={saveMakingChargeForm}>
          <p className="form-help">
            This configured amount is charged once per purchase, regardless of weight. Making charges do not apply to sell orders.
          </p>
          <label className="field-block">
            <span>Fixed making charge per purchase (₹)</span>
            <input
              aria-label="Fixed making charge per purchase (₹)"
              type="number"
              min="0"
              step="0.01"
              required
              value={makingChargeValue}
              onChange={(event) => setMakingChargeValue(event.target.value)}
            />
          </label>
          <div className="form-check-row">
            <label>
              <input
                type="checkbox"
                checked={makingChargeEnabled}
                onChange={(event) => setMakingChargeEnabled(event.target.checked)}
              />
              Making charge enabled for {makingChargeForm?.metal ?? 'this metal'}
            </label>
          </div>
          {makingChargeError && <p className="form-feedback" role="alert">{makingChargeError}</p>}
          <div className="form-actions">
            <button type="button" className="button button-secondary" onClick={() => setMakingChargeForm(null)}>Cancel</button>
            <button type="submit" className="button button-primary">Save making charge</button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog open={Boolean(confirmProduct)} title={`${confirmProduct?.status === 'Active' ? 'Deactivate' : 'Activate'} product?`} description={`${confirmProduct?.name} will be ${confirmProduct?.status === 'Active' ? 'hidden from' : 'available in'} the demo catalog.`} confirmLabel={confirmProduct?.status === 'Active' ? 'Deactivate' : 'Activate'} destructive={confirmProduct?.status === 'Active'} onCancel={() => setConfirmProduct(null)} onConfirm={() => { toggleProduct(confirmProduct.id); setConfirmProduct(null); }} />
    </>
  );
}
