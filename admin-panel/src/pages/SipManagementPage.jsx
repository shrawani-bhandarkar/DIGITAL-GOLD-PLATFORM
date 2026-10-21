import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, CirclePause, CirclePlay, Plus, Search } from 'lucide-react';
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
import { calculateSipSchedule, formatPaise, parseMoneyPaise, sumPaise } from '../utils/financial.js';
import useDocumentTitle from '../hooks/useDocumentTitle.js';

const PAGE_SIZE = 7;

export default function SipManagementPage() {
  useDocumentTitle('SIP management');
  const { customers, products } = useManagement();
  const { sips, addSip, updateSip } = useOperations();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All statuses');
  const [metalFilter, setMetalFilter] = useState('All metals');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedSip, setSelectedSip] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [formError, setFormError] = useState('');
  const [frequency, setFrequency] = useState('Monthly');
  const [firstDebitDate, setFirstDebitDate] = useState('2026-10-20');
  const [installmentCount, setInstallmentCount] = useState('12');
  const [amountInput, setAmountInput] = useState('');
  const term = query.trim().toLowerCase();
  const filtered = useMemo(() => sips.filter((sip) => (
    [sip.id, sip.customer, sip.customerId, sip.metal].some((value) => value.toLowerCase().includes(term))
    && (statusFilter === 'All statuses' || sip.status === statusFilter)
    && (metalFilter === 'All metals' || sip.metal === metalFilter)
  )), [sips, term, statusFilter, metalFilter]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);
  let scheduleDates = [];
  let scheduleError = '';
  try {
    if (firstDebitDate && installmentCount) scheduleDates = calculateSipSchedule(firstDebitDate, frequency, Number(installmentCount));
  } catch (error) {
    scheduleError = error.message;
  }
  let plannedTotal = '';
  try {
    if (amountInput && scheduleDates.length) {
      const installmentPaise = parseMoneyPaise(amountInput, 'Installment amount');
      plannedTotal = formatPaise(sumPaise(Array(scheduleDates.length).fill(installmentPaise), 'Planned SIP total'));
    }
  } catch {
    plannedTotal = '';
  }

  async function submitSip(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const customer = customers.find((item) => item.id === data.customerId);
    const product = products.find((item) => item.id === data.productId && item.status === 'Active');
    const installments = Number(data.installments);
    let amountPaise;
    let dates;
    if (!customer || !product) {
      setFormError('Select an eligible customer and an active metal product.');
      return;
    }
    try {
      amountPaise = parseMoneyPaise(data.amount, 'Installment amount');
      dates = calculateSipSchedule(data.nextDebit, data.frequency, installments);
    } catch (error) {
      setFormError(error.message);
      return;
    }
    if (amountPaise / 100 < product.minOrder || amountPaise / 100 > product.maxOrder) {
      setFormError(`Installment must be between ${formatCurrency(product.minOrder)} and ${formatCurrency(product.maxOrder)}.`);
      return;
    }
    const saved = await addSip({
      id: `SIP-2026-${String(Date.now()).slice(-5)}`, customerId: customer.id,
      customer: customer.name, metal: product.metal, purity: product.purity,
      amount: amountPaise / 100, frequency: data.frequency, nextDebit: dates[0], scheduleDates: dates,
      plannedTotalPaise: sumPaise(Array(installments).fill(amountPaise), 'Planned SIP total'),
      started: '15 Oct 2026', installments: `0 of ${installments}`, status: 'Active',
      timeline: [{ label: 'SIP plan created (simulated)', time: '15 Oct, just now', done: true }, { label: 'First installment scheduled', time: data.nextDebit, done: false }],
    });
    if (!saved) { setFormError('Could not save the SIP plan. Check the database connection and try again.'); return; }
    setPage(1);
    setFormOpen(false);
    setFormError('');
    setAmountInput('');
  }

  const columns = [
    { key: 'id', label: 'Plan', render: (value, row) => <button className="inline-table-link" onClick={() => setSelectedSip(row)}><strong>{value}</strong><small>{row.started}</small></button> },
    { key: 'customer', label: 'Customer', render: (value, row) => <div className="management-secondary"><strong>{value}</strong><small>{row.customerId}</small></div> },
    { key: 'metal', label: 'Metal', render: (value, row) => <div className="management-secondary"><strong>{value}</strong><small>{row.purity}</small></div> },
    { key: 'amount', label: 'Installment', align: 'right', render: (value, row) => <div className="management-secondary align-right"><strong>{formatCurrency(value)}</strong><small>{row.frequency}</small></div> },
    { key: 'installments', label: 'Progress' },
    { key: 'nextDebit', label: 'Next debit' },
    { key: 'status', label: 'Status', render: (value) => <StatusBadge status={value} /> },
    { key: 'actions', label: 'Actions', render: (_, row) => row.status === 'Active' || row.status === 'Paused' ? <div className="table-row-actions"><button className="text-action" onClick={() => setPendingAction({ sip: row, status: row.status === 'Active' ? 'Paused' : 'Active' })}>{row.status === 'Active' ? 'Pause' : 'Resume'}</button><button className="text-action text-action-danger" onClick={() => setPendingAction({ sip: row, status: 'Cancelled' })}>Cancel</button></div> : <span className="table-muted">—</span> },
  ];

  return (
    <>
      <PageHeader eyebrow="SAVINGS PLANS" title="SIP management" description="Monitor recurring savings plans and manage their simulated lifecycle." actions={<button className="button button-primary" onClick={() => { setFormError(''); setFrequency('Monthly'); setFirstDebitDate('2026-10-20'); setInstallmentCount('12'); setAmountInput(''); setFormOpen(true); }}><Plus size={15} /> Create SIP</button>} />
      <SimulatedBanner>SIP plans and schedules are stored in MySQL. Scheduled debits and investments are not performed.</SimulatedBanner>
      <section className="management-stat-grid">
        <article><span className="management-stat-icon stat-icon-teal"><CalendarClock size={17} /></span><div><span>Total SIP plans</span><strong>{sips.length}</strong></div></article>
        <article><span className="management-stat-icon stat-icon-blue"><CirclePlay size={17} /></span><div><span>Active plans</span><strong>{sips.filter((sip) => sip.status === 'Active').length}</strong></div></article>
        <article><span className="management-stat-icon stat-icon-amber"><CirclePause size={17} /></span><div><span>Paused plans</span><strong>{sips.filter((sip) => sip.status === 'Paused').length}</strong></div></article>
      </section>
      <section className="panel management-panel">
        <div className="management-toolbar">
          <label className="management-search"><Search size={16} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search plan, customer or metal" aria-label="Search SIP plans" /></label>
          <div className="management-filters">
            <select value={metalFilter} onChange={(event) => { setMetalFilter(event.target.value); setPage(1); }} aria-label="Filter by metal"><option>All metals</option>{[...new Set(sips.map((sip) => sip.metal))].map((metal) => <option key={metal}>{metal}</option>)}</select>
            <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} aria-label="Filter SIP status"><option>All statuses</option><option>Active</option><option>Paused</option><option>Completed</option><option>Cancelled</option></select>
          </div>
        </div>
        <DataTable columns={columns} rows={rows} allRows={filtered} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
        <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
      </section>
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Create SIP" description="Create a stored recurring plan; scheduled installments will not be charged by this API.">
        <form className="management-form" onSubmit={submitSip}>
          <div className="form-grid">
            <label className="field-block form-grid-full"><span>Customer</span><select name="customerId" required defaultValue=""><option value="" disabled>Select a customer</option>{customers.filter((customer) => customer.status === 'Active' && customer.kycStatus === 'Verified').map((customer) => <option key={customer.id} value={customer.id}>{customer.name} · {customer.id}</option>)}</select></label>
            <label className="field-block form-grid-full"><span>Metal product</span><select name="productId" required defaultValue=""><option value="" disabled>Select a product</option>{products.filter((product) => product.status === 'Active').map((product) => <option key={product.id} value={product.id}>{product.name} · {product.purity}</option>)}</select></label>
            <label className="field-block"><span>Installment amount (₹)</span><input name="amount" type="number" min="0.01" step="0.01" required value={amountInput} onChange={(event) => setAmountInput(event.target.value)} /></label>
            <label className="field-block"><span>Frequency</span><select name="frequency" value={frequency} onChange={(event) => setFrequency(event.target.value)}><option>Weekly</option><option>Monthly</option></select></label>
            <label className="field-block"><span>Number of installments</span><input name="installments" type="number" min="2" max="60" step="1" required value={installmentCount} onChange={(event) => setInstallmentCount(event.target.value)} /></label>
            <label className="field-block"><span>First debit date</span><input name="nextDebit" type="date" min="2026-10-15" required value={firstDebitDate} onChange={(event) => setFirstDebitDate(event.target.value)} /></label>
          </div>
          {scheduleDates.length > 0 && <p className="form-help">Demo schedule: {scheduleDates[0]} to {scheduleDates[scheduleDates.length - 1]} · {scheduleDates.length} installments · planned total {plannedTotal || 'enter a valid amount'}. No recurring payments are scheduled.</p>}
          {scheduleError && <p className="form-feedback" role="alert">{scheduleError}</p>}
          {formError && <p className="form-feedback" role="alert">{formError}</p>}
          <div className="form-actions"><button type="button" className="button button-secondary" onClick={() => setFormOpen(false)}>Cancel</button><button type="submit" className="button button-primary">Create demo SIP</button></div>
        </form>
      </Modal>
      <Modal open={Boolean(selectedSip)} onClose={() => setSelectedSip(null)} title={selectedSip?.id ?? 'SIP details'} description="Installment plan history · simulated">
        {selectedSip && <><div className="sip-detail-summary"><strong>{selectedSip.customer}</strong><span>{formatCurrency(selectedSip.amount)} · {selectedSip.frequency} · {selectedSip.metal}</span><span>Demo schedule: {selectedSip.scheduleDates?.length ?? '—'} installments · planned total {selectedSip.plannedTotalPaise == null ? '—' : formatPaise(selectedSip.plannedTotalPaise)}</span><StatusBadge status={selectedSip.status} /></div><StatusTimeline items={selectedSip.timeline} /></>}
      </Modal>
      <ConfirmDialog open={Boolean(pendingAction)} title={`${pendingAction?.status === 'Paused' ? 'Pause' : pendingAction?.status === 'Cancelled' ? 'Cancel' : 'Resume'} SIP plan?`} description={`This simulated change applies to ${pendingAction?.sip.id} only. No installment debit will be affected.`} confirmLabel={pendingAction?.status === 'Paused' ? 'Pause plan' : pendingAction?.status === 'Cancelled' ? 'Cancel plan' : 'Resume plan'} destructive={pendingAction?.status === 'Cancelled'} onCancel={() => setPendingAction(null)} onConfirm={() => { updateSip(pendingAction.sip.id, pendingAction.status); setPendingAction(null); }} />
    </>
  );
}
