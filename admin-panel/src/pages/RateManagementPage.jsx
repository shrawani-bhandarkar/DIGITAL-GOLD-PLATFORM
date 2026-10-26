import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Clock3, Plus, Search, X } from 'lucide-react';
import DataTable from '../components/DataTable.jsx';
import PageHeader from '../components/PageHeader.jsx';
import Pagination from '../components/Pagination.jsx';
import Modal from '../components/Modal.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { useManagement } from '../context/ManagementContext.jsx';
import { useAdmin } from '../context/AdminContext.jsx';
import { apiRequest } from '../services/apiClient.js';
import { formatCurrency } from '../utils/formatters.js';
import useDocumentTitle from '../hooks/useDocumentTitle.js';

const PAGE_SIZE = 7;
const METAL_TYPES = ['Gold', 'Silver', 'Platinum'];

export default function RateManagementPage() {
  useDocumentTitle('Rate management');
  const { products, rateRequests, addRateRequest, reviewRateRequest } = useManagement();
  const { activeRoleId } = useAdmin();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All statuses');
  const [metalFilter, setMetalFilter] = useState('All metals');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [rejectRequest, setRejectRequest] = useState(null);
  const [metalPrices, setMetalPrices] = useState([]);
  const [metalPricesLoading, setMetalPricesLoading] = useState(true);
  const [metalPricesError, setMetalPricesError] = useState('');
  const [metalPriceFormError, setMetalPriceFormError] = useState('');
  const [metalPriceSaved, setMetalPriceSaved] = useState(false);
  const [savingMetalPrice, setSavingMetalPrice] = useState(false);
  const isSuperAdmin = activeRoleId === 'SUPER_ADMIN';

  const loadMetalPrices = useCallback(async () => {
    setMetalPricesLoading(true);
    try {
      const result = await apiRequest('/api/admin/metal-prices');
      if (!Array.isArray(result?.rates)) throw new Error('API returned invalid metal price data.');
      setMetalPrices(result.rates);
      setMetalPricesError('');
      return true;
    } catch (error) {
      setMetalPricesError(error.message);
      return false;
    } finally {
      setMetalPricesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMetalPrices();
  }, [loadMetalPrices]);

  const filteredRequests = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return rateRequests.filter((request) => (
      [request.id, request.metal, request.purity, request.requestedBy].some((value) => value.toLowerCase().includes(normalized))
      && (statusFilter === 'All statuses' || request.status === statusFilter)
      && (metalFilter === 'All metals' || request.metal === metalFilter)
    ));
  }, [rateRequests, query, statusFilter, metalFilter]);
  const visibleRequests = filteredRequests.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE));
  const pendingCount = rateRequests.filter((request) => request.status === 'Pending').length;
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  async function submitRequest(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const buyRate = Number(values.buyRate);
    const sellRate = Number(values.sellRate);
    if (buyRate <= 0 || sellRate <= 0 || sellRate >= buyRate) {
      setFormError('Enter positive rates, with the customer sell rate lower than the buy rate.');
      return;
    }
    const selectedProduct = products.find((product) => product.id === values.productId);
    if (!selectedProduct) {
      setFormError('Choose an available product before submitting the rate request.');
      return;
    }
    const saved = await addRateRequest({
      id: `RATE-2026-${String(Date.now()).slice(-3)}`,
      metal: selectedProduct.metal,
      purity: selectedProduct.purity,
      buyRate,
      sellRate,
      change: 'Pending review',
      status: 'Pending',
      requestedBy: 'Super Admin',
      requestedAt: '15 Oct 2026, just now',
    });
    if (!saved) { setFormError('Could not save the rate request. Check the database connection and try again.'); return; }
    setPage(1);
    setFormOpen(false);
    setFormError('');
  }

  const columns = [
    { key: 'id', label: 'Request', render: (value, row) => <div className="management-secondary"><strong>{value}</strong><small>{row.requestedAt}</small></div> },
    { key: 'metal', label: 'Metal / purity', render: (value, row) => <div className="management-secondary"><strong>{value}</strong><small>{row.purity}</small></div> },
    { key: 'buyRate', label: 'Buy / gram', align: 'right', render: (value) => formatCurrency(value) },
    { key: 'sellRate', label: 'Sell / gram', align: 'right', render: (value) => formatCurrency(value) },
    { key: 'change', label: 'Change', render: (value) => <span className={value.startsWith('+') ? 'rate-positive' : value.startsWith('-') ? 'rate-negative' : 'rate-neutral'}>{value}</span> },
    { key: 'status', label: 'Status', render: (value) => <StatusBadge status={value} /> },
    { key: 'actions', label: 'Review', render: (_, row) => row.status === 'Pending' ? <div className="table-row-actions"><button className="review-icon approve" aria-label={`Approve ${row.id}`} title="Approve rate" onClick={() => reviewRateRequest(row.id, 'Approved')}><Check size={15} /></button><button className="review-icon reject" aria-label={`Reject ${row.id}`} title="Reject rate" onClick={() => setRejectRequest(row)}><X size={15} /></button></div> : <span className="table-muted">{row.requestedBy}</span> },
  ];
  const currentRateColumns = [
    { key: 'name', label: 'Product', render: (value, row) => <div className="management-secondary"><strong>{value}</strong><small>{row.metal} · {row.purity} purity</small></div> },
    { key: 'buyRate', label: 'Buy / gram', align: 'right', render: (value) => formatCurrency(value) },
    { key: 'sellRate', label: 'Sell / gram', align: 'right', render: (value) => formatCurrency(value) },
    { key: 'buyChargeBps', label: 'Buy charge / tax', render: (_, row) => `${(row.buyChargeBps ?? 0) / 100}% / ${(row.buyTaxBps ?? 0) / 100}%` },
    { key: 'sellChargeBps', label: 'Sell charge / tax', render: (_, row) => `${(row.sellChargeBps ?? 0) / 100}% / ${(row.sellTaxBps ?? 0) / 100}%` },
    { key: 'redemptionEnabled', label: 'Redemption', render: (_, row) => row.redemptionEnabled
      ? `${row.allowCoinDelivery ? 'Coin' : ''}${row.allowCoinDelivery && row.allowCashPayout ? ' / ' : ''}${row.allowCashPayout ? 'Cash' : ''} · ${formatCurrency((row.redemptionChargePaise ?? 0) / 100)} delivery`
      : 'Not configured' },
  ];
  const currentMetalPriceColumns = [
    { key: 'metalType', label: 'Metal' },
    { key: 'purity', label: 'Purity' },
    { key: 'ratePerGram', label: 'Rate / gram', align: 'right', render: (value) => formatCurrency(value) },
    { key: 'effectiveDate', label: 'Effective date' },
    { key: 'updatedAt', label: 'Updated at' },
  ];

  async function submitMetalPrice(event) {
    event.preventDefault();
    setMetalPriceFormError('');
    setMetalPriceSaved(false);
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    const ratePerGram = Number(values.ratePerGram);
    if (!METAL_TYPES.includes(values.metalType) || !Number.isFinite(ratePerGram) || ratePerGram <= 0) {
      setMetalPriceFormError('Choose a metal and enter a positive rate per gram.');
      return;
    }
    setSavingMetalPrice(true);
    try {
      await apiRequest('/api/admin/metal-prices', {
        method: 'POST',
        body: {
          metalType: values.metalType,
          ratePerGram,
          purity: values.purity,
          effectiveDate: values.effectiveDate,
        },
      });
      const refreshed = await loadMetalPrices();
      if (!refreshed) {
        setMetalPriceFormError('The price was saved, but the current rates could not be refreshed.');
        return;
      }
      form.reset();
      setMetalPriceSaved(true);
    } catch (error) {
      setMetalPriceFormError(error.message);
    } finally {
      setSavingMetalPrice(false);
    }
  }

  return (
    <>
      <PageHeader eyebrow="PRICING OPERATIONS" title="Rate management" description="Manage daily metal prices and review product rate change requests." actions={<button className="button button-primary" onClick={() => { setFormError(''); setFormOpen(true); }}><Plus size={15} /> Request rate change</button>} />
      <div className="demo-data-banner"><span className="demo-data-pulse" /><strong>DATABASE</strong><span>Rate requests and product rates are stored in MySQL; no external market feed is connected.</span></div>
      <section className="management-stat-grid">
        <article><span className="management-stat-icon stat-icon-teal"><span className="stat-mini-dot" /></span><div><span>Active metal products</span><strong>{products.filter((product) => product.status === 'Active').length}</strong></div></article>
        <article><span className="management-stat-icon stat-icon-amber"><Clock3 size={17} /></span><div><span>Awaiting approval</span><strong>{pendingCount}</strong></div></article>
        <article><span className="management-stat-icon stat-icon-blue"><Check size={17} /></span><div><span>Approved requests</span><strong>{rateRequests.filter((request) => request.status === 'Approved').length}</strong></div></article>
      </section>
      <section className="panel management-panel">
        <div className="panel-heading rate-list-heading">
          <div><h2>Current metal prices</h2><p>Customer-facing prices are read from the latest MySQL rate effective today.</p></div>
        </div>
        {metalPricesLoading ? <p role="status">Loading current metal prices…</p> : (
          <DataTable columns={currentMetalPriceColumns} rows={metalPrices} rowKey="id" />
        )}
        {metalPricesError && <p className="form-feedback" role="alert">{metalPricesError}</p>}
        {isSuperAdmin ? (
          <form className="management-form" onSubmit={submitMetalPrice}>
            <div className="form-grid">
              <label className="field-block"><span>Metal</span><select name="metalType" required defaultValue="Gold">{METAL_TYPES.map((metal) => <option key={metal}>{metal}</option>)}</select></label>
              <label className="field-block"><span>Rate per gram (₹)</span><input name="ratePerGram" type="number" min="0.0001" step="0.0001" required placeholder="e.g. 7825" /></label>
              <label className="field-block"><span>Purity</span><input name="purity" type="text" maxLength="32" required placeholder="e.g. 24K / 999.9%" /></label>
              <label className="field-block"><span>Effective date</span><input name="effectiveDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></label>
            </div>
            {metalPriceFormError && <p className="form-feedback" role="alert">{metalPriceFormError}</p>}
            {metalPriceSaved && <p className="form-feedback" role="status">Daily metal price saved and current rates refreshed.</p>}
            <div className="form-actions"><button type="submit" className="button button-primary" disabled={savingMetalPrice}>{savingMetalPrice ? 'Saving…' : 'Save daily metal price'}</button></div>
          </form>
        ) : <p className="form-hint">Only the Super Admin can add or update daily prices and purity.</p>}
      </section>
      <section className="panel management-panel">
        <div className="panel-heading rate-list-heading"><div><h2>Metal product rates and rules</h2><p>These product-specific buy and sell settings are separate from the daily customer-facing metal prices above.</p></div></div>
        <DataTable columns={currentRateColumns} rows={products.filter((product) => product.status === 'Active')} rowKey="id" />
      </section>
      <section className="panel management-panel">
        <div className="panel-heading rate-list-heading"><div><h2>Rate change requests</h2><p>Every proposed rate change requires review before it becomes active.</p></div></div>
        <div className="management-toolbar">
          <label className="management-search"><Search size={16} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search request, metal or purity" aria-label="Search rate requests" /></label>
          <div className="management-filters">
            <select value={metalFilter} onChange={(event) => { setMetalFilter(event.target.value); setPage(1); }} aria-label="Filter by metal"><option>All metals</option>{[...new Set(rateRequests.map((request) => request.metal))].map((metal) => <option key={metal}>{metal}</option>)}</select>
            <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} aria-label="Filter by request status"><option>All statuses</option><option>Pending</option><option>Approved</option><option>Rejected</option></select>
          </div>
        </div>
        <DataTable columns={columns} rows={visibleRequests} allRows={filteredRequests} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} rowKey="id" />
        <Pagination page={page} pageSize={PAGE_SIZE} total={filteredRequests.length} onPageChange={setPage} />
      </section>
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Request rate change" description="New rates remain pending until an administrator approves them.">
        <form className="management-form" onSubmit={submitRequest}>
          <div className="form-grid">
            <label className="field-block form-grid-full"><span>Metal product</span><select name="productId" required defaultValue=""><option value="" disabled>Select a product</option>{products.filter((product) => product.status === 'Active').map((product) => <option key={product.id} value={product.id}>{product.name} · {product.purity}</option>)}</select></label>
            <label className="field-block"><span>Buy rate / gram (₹)</span><input name="buyRate" type="number" min="0.01" step="0.01" required placeholder="e.g. 7825" /></label>
            <label className="field-block"><span>Sell rate / gram (₹)</span><input name="sellRate" type="number" min="0.01" step="0.01" required placeholder="e.g. 7580" /></label>
          </div>
          {formError && <p className="form-feedback" role="alert">{formError}</p>}
          <p className="form-hint">The customer sell rate must remain below the platform buy rate.</p>
          <div className="form-actions"><button type="button" className="button button-secondary" onClick={() => setFormOpen(false)}>Cancel</button><button type="submit" className="button button-primary">Submit for approval</button></div>
        </form>
      </Modal>
      <ConfirmDialog open={Boolean(rejectRequest)} title="Reject rate change?" description={`The ${rejectRequest?.metal} rate request ${rejectRequest?.id} will not be published.`} confirmLabel="Reject request" destructive onCancel={() => setRejectRequest(null)} onConfirm={() => { reviewRateRequest(rejectRequest.id, 'Rejected'); setRejectRequest(null); }} />
    </>
  );
}
