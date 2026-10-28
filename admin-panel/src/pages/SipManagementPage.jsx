import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, CirclePause, CirclePlay, Plus, Search } from 'lucide-react';
import DataTable from '../components/DataTable.jsx';
import PageHeader from '../components/PageHeader.jsx';
import Pagination from '../components/Pagination.jsx';
import Modal from '../components/Modal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import SimulatedBanner from '../components/SimulatedBanner.jsx';
import { useManagement } from '../context/ManagementContext.jsx';
import { useOperations } from '../context/OperationsContext.jsx';
import { formatCurrency } from '../utils/formatters.js';
import { calculateSipSchedule, formatPaise, parseMoneyPaise } from '../utils/financial.js';
import useDocumentTitle from '../hooks/useDocumentTitle.js';

const PAGE_SIZE = 7;

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function addMonths(date, months) {
  const [year, month, day] = date.split('-').map(Number);
  const targetMonth = month - 1 + months;
  const targetYear = year + Math.floor(targetMonth / 12);
  const monthIndex = targetMonth % 12;
  const lastDay = new Date(Date.UTC(targetYear, monthIndex + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetYear, monthIndex, Math.min(day, lastDay))).toISOString().slice(0, 10);
}

export default function SipManagementPage() {
  useDocumentTitle('SIP management');
  const { products } = useManagement();
  const {
    sips, addSip, updateSip, fetchSipDetails, updateSipInstallment,
  } = useOperations();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All statuses');
  const [metalFilter, setMetalFilter] = useState('All metals');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedSip, setSelectedSip] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [formError, setFormError] = useState('');
  const [actionError, setActionError] = useState('');
  const [contributionDurationMonths, setContributionDurationMonths] = useState('12');
  const [contributionAmountInput, setContributionAmountInput] = useState('');
  const [durationMonths, setDurationMonths] = useState('12');
  const [amountInput, setAmountInput] = useState('');
  const [startDate, setStartDate] = useState(todayDate);
  const term = query.trim().toLowerCase();
  const filtered = useMemo(() => sips.filter((sip) => (
    [sip.id, sip.customer, sip.customerId, sip.metal]
      .some((value) => String(value ?? '').toLowerCase().includes(term))
    && (statusFilter === 'All statuses' || sip.status === statusFilter)
    && (metalFilter === 'All metals' || sip.metal === metalFilter)
  )), [sips, term, statusFilter, metalFilter]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  let scheduleDates = [];
  let scheduleError = '';
  try {
    if (startDate && contributionDurationMonths && durationMonths) {
      const ownerMonths = Number(contributionDurationMonths);
      if (!Number.isInteger(ownerMonths) || ownerMonths < 1 || ownerMonths > 60) {
        throw new RangeError('Choose a shop owner contribution duration between 1 and 60 months.');
      }
      const customerStartDate = addMonths(startDate, ownerMonths);
      scheduleDates = calculateSipSchedule(customerStartDate, 'Monthly', Number(durationMonths));
    }
  } catch (error) {
    scheduleError = error.message;
  }
  let totalShopOwnerContribution = '';
  let totalCustomerPayments = '';
  try {
    if (contributionAmountInput && contributionDurationMonths) {
      const monthlyPaise = parseMoneyPaise(contributionAmountInput, 'Shop owner monthly contribution');
      totalShopOwnerContribution = formatPaise(monthlyPaise * BigInt(contributionDurationMonths));
    }
  } catch (error) {
    scheduleError = error.message;
  }
  try {
    if (amountInput && durationMonths) {
      const monthlyPaise = parseMoneyPaise(amountInput, 'Customer monthly payment');
      totalCustomerPayments = formatPaise(monthlyPaise * BigInt(durationMonths));
    }
  } catch (error) {
    scheduleError = error.message;
  }
  let totalInvestment = '';
  if (totalShopOwnerContribution && totalCustomerPayments) {
    const ownerTotalPaise = parseMoneyPaise(totalShopOwnerContribution, 'Shop owner contribution total');
    const customerTotalPaise = parseMoneyPaise(totalCustomerPayments, 'Customer payment total');
    totalInvestment = formatPaise(ownerTotalPaise + customerTotalPaise);
  }

  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  async function submitSip(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const product = products.find((item) => item.id === data.productId && item.status === 'Active');
    if (!product) {
      setFormError('Select an active metal.');
      return;
    }
    try {
      const contributionPaise = parseMoneyPaise(data.contributionMonthlyAmount, 'Shop owner monthly contribution');
      const contributionMonths = Number(data.contributionDurationMonths);
      if (!Number.isInteger(contributionMonths) || contributionMonths < 1 || contributionMonths > 60) {
        throw new RangeError('Choose a shop owner contribution duration between 1 and 60 months.');
      }
      const customerPaise = parseMoneyPaise(data.monthlyAmount, 'Customer monthly payment');
      if (!Number.isInteger(Number(data.durationMonths)) || Number(data.durationMonths) < 2 || Number(data.durationMonths) > 60) {
        throw new RangeError('Choose a customer payment duration between 2 and 60 months.');
      }
      const saved = await addSip({
        productId: product.id,
        contributionMonthlyAmount: Number((Number(contributionPaise) / 100).toFixed(2)),
        contributionDurationMonths: contributionMonths,
        monthlyAmount: Number((Number(customerPaise) / 100).toFixed(2)),
        durationMonths: Number(data.durationMonths),
      });
      if (!saved) {
        setFormError('Could not save the SIP plan. Check the database connection and try again.');
        return;
      }
    } catch (error) {
      setFormError(error.message);
      return;
    }
    setPage(1);
    setFormOpen(false);
    setFormError('');
    setAmountInput('');
  }

  async function openDetails(sip) {
    setSelectedSip({ sip, installments: [] });
    setDetailLoading(true);
    setActionError('');
    const details = await fetchSipDetails(sip.id);
    if (details) setSelectedSip(details);
    setDetailLoading(false);
  }

  async function confirmAction() {
    if (!pendingAction) return;
    setActionError('');
    if (pendingAction.type === 'status') {
      const updated = await updateSip(pendingAction.sip.id, pendingAction.status);
      if (updated && selectedSip?.sip?.id === pendingAction.sip.id) {
        setSelectedSip((current) => ({ ...current, sip: updated }));
      }
      if (!updated) setActionError('Could not update the SIP plan.');
    } else {
      const updated = await updateSipInstallment(pendingAction.sip.id, pendingAction.type);
      if (updated) setSelectedSip(updated);
      else setActionError('Could not update the SIP installment.');
    }
    setPendingAction(null);
  }

  const columns = [
    { key: 'id', label: 'Plan', render: (value, row) => <button className="inline-table-link" onClick={() => openDetails(row)}><strong>{value}</strong><small>Started {row.startDate}</small></button> },
    { key: 'customer', label: 'Customer', render: (value, row) => <div className="management-secondary"><strong>{value || 'Unassigned'}</strong>{row.customerId ? <small>{row.customerId}</small> : null}</div> },
    { key: 'metal', label: 'Metal' },
    { key: 'contributionDurationMonths', label: 'Shop owner months', render: (value) => `${value} months` },
    { key: 'durationMonths', label: 'Customer payment months', render: (value) => `${value} months` },
    { key: 'monthlyContribution', label: 'Shop owner monthly', align: 'right', render: (value) => formatCurrency(value) },
    { key: 'amount', label: 'Customer monthly payment', align: 'right', render: (value) => formatCurrency(value) },
    { key: 'totalShopOwnerContribution', label: 'Owner contribution total', align: 'right', render: (value) => formatCurrency(value) },
    { key: 'totalCustomerPayments', label: 'Customer payment total', align: 'right', render: (value) => formatCurrency(value) },
    { key: 'totalInvestment', label: 'Total investment', align: 'right', render: (value) => formatCurrency(value) },
    { key: 'paidCount', label: 'Paid / pending / skipped', render: (_, row) => `${row.paidCount} / ${row.pendingCount} / ${row.skippedCount}` },
    { key: 'nextDebit', label: 'Next due date', render: (value) => value || '—' },
    { key: 'maturityDate', label: 'Maturity date' },
    { key: 'status', label: 'Status', render: (value) => <StatusBadge status={value} /> },
    { key: 'actions', label: 'Actions', render: (_, row) => row.status === 'Active' || row.status === 'Paused' ? <div className="table-row-actions"><button className="text-action" onClick={() => setPendingAction({ type: 'status', sip: row, status: row.status === 'Active' ? 'Paused' : 'Active' })}>{row.status === 'Active' ? 'Pause' : 'Resume'}</button><button className="text-action text-action-danger" onClick={() => setPendingAction({ type: 'status', sip: row, status: 'Cancelled' })}>Cancel</button></div> : <button className="text-action" onClick={() => openDetails(row)}>Details</button> },
  ];

  return (
    <>
      <PageHeader eyebrow="SAVINGS PLANS" title="SIP management" description="Configure SIP plans and track monthly installment payments, skips, and maturity dates." actions={<button className="button button-primary" onClick={() => { setFormError(''); setStartDate(todayDate()); setContributionDurationMonths('12'); setContributionAmountInput(''); setDurationMonths('12'); setAmountInput(''); setFormOpen(true); }}><Plus size={15} /> Create SIP</button>} />
      <SimulatedBanner>SIP plans and monthly installment statuses are stored in MySQL. The system does not initiate automatic debits.</SimulatedBanner>
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
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Create SIP" description="Configure a monthly investment plan and its installment schedule.">
        <form className="management-form" onSubmit={submitSip}>
          <div className="form-grid">
            <label className="field-block form-grid-full"><span>Metal</span><select name="productId" required defaultValue=""><option value="" disabled>Select a metal</option>{products.filter((product) => product.status === 'Active').map((product) => <option key={product.id} value={product.id}>{product.metal} · {product.purity}</option>)}</select></label>
            <label className="field-block"><span>Shop owner monthly contribution (₹)</span><input name="contributionMonthlyAmount" type="number" min="0.01" step="0.01" required value={contributionAmountInput} onChange={(event) => setContributionAmountInput(event.target.value)} /></label>
            <label className="field-block"><span>Shop owner contribution duration (months)</span><input name="contributionDurationMonths" type="number" min="1" max="60" step="1" required value={contributionDurationMonths} onChange={(event) => setContributionDurationMonths(event.target.value)} /></label>
            <label className="field-block"><span>Customer monthly payment (₹)</span><input name="monthlyAmount" type="number" min="0.01" step="0.01" required value={amountInput} onChange={(event) => setAmountInput(event.target.value)} /></label>
            <label className="field-block"><span>Customer payment duration (months)</span><input name="durationMonths" type="number" min="2" max="60" step="1" required value={durationMonths} onChange={(event) => setDurationMonths(event.target.value)} /></label>
          </div>
          {scheduleDates.length > 0 && <p className="form-help">Shop owner contribution total: {totalShopOwnerContribution || 'enter a valid amount'} · Customer payments total: {totalCustomerPayments || 'enter a valid amount'} · Combined total: {totalInvestment || 'enter both valid amounts'} · Start date {startDate} · Customer payments start {scheduleDates[0]} · maturity {scheduleDates[scheduleDates.length - 1]} · {Number(contributionDurationMonths) + Number(durationMonths)} months total.</p>}
          {scheduleError && <p className="form-feedback" role="alert">{scheduleError}</p>}
          {formError && <p className="form-feedback" role="alert">{formError}</p>}
          <div className="form-actions"><button type="button" className="button button-secondary" onClick={() => setFormOpen(false)}>Cancel</button><button type="submit" className="button button-primary">Create SIP plan</button></div>
        </form>
      </Modal>
      <Modal open={Boolean(selectedSip)} onClose={() => setSelectedSip(null)} title={selectedSip?.sip?.id ?? 'SIP details'} description="Persisted plan schedule and installment payment status.">
        {selectedSip?.sip ? (
          <div className="sip-detail-summary">
            <strong>{selectedSip.sip.customer || 'Unassigned'} · {selectedSip.sip.metal}</strong>
            <span>Shop owner: {formatCurrency(selectedSip.sip.monthlyContribution)} per month for {selectedSip.sip.contributionDurationMonths} months · Total {formatCurrency(selectedSip.sip.totalShopOwnerContribution)}</span>
            <span>Customer: {formatCurrency(selectedSip.sip.amount)} per month for {selectedSip.sip.durationMonths} months · Total {formatCurrency(selectedSip.sip.totalCustomerPayments)}</span>
            <span>Total investment: {formatCurrency(selectedSip.sip.totalInvestment)}</span>
            <span>Start: {selectedSip.sip.startDate} · Next due: {selectedSip.sip.nextDebit || '—'} · Maturity: {selectedSip.sip.maturityDate}</span>
            <span>Paid: {selectedSip.sip.paidCount} · Pending: {selectedSip.sip.pendingCount} · Skipped: {selectedSip.sip.skippedCount}</span>
            <StatusBadge status={selectedSip.sip.status} />
            {detailLoading ? <p className="empty-state">Loading installments…</p> : (
              <div className="table-scroll"><table><thead><tr><th>Month</th><th>Due date</th><th>Amount</th><th>Payment status</th></tr></thead><tbody>
                {(selectedSip.installments ?? []).map((installment) => <tr key={installment.id}><td>{installment.number}</td><td>{installment.dueDate}</td><td>{formatCurrency(installment.amount)}</td><td>{installment.status}</td></tr>)}
              </tbody></table></div>
            )}
            {selectedSip.sip.status === 'Active' && selectedSip.sip.pendingCount > 0 ? (
              <div className="form-actions">
                <button className="button button-secondary" disabled={detailLoading} onClick={() => setPendingAction({ type: 'paid', sip: selectedSip.sip })}>Mark next installment paid</button>
                <button className="button button-secondary button-reject" disabled={detailLoading} onClick={() => setPendingAction({ type: 'skip', sip: selectedSip.sip })}>Skip next installment</button>
              </div>
            ) : null}
            {actionError ? <p className="form-feedback" role="alert">{actionError}</p> : null}
          </div>
        ) : null}
      </Modal>
      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={pendingAction?.type === 'skip' ? 'Skip next SIP installment?' : pendingAction?.type === 'paid' ? 'Mark installment paid?' : `${pendingAction?.status === 'Paused' ? 'Pause' : pendingAction?.status === 'Cancelled' ? 'Cancel' : 'Resume'} SIP plan?`}
        description={pendingAction?.type === 'skip'
          ? `This installment will be marked skipped and the SIP maturity date extended for ${pendingAction.sip.id}.`
          : pendingAction?.type === 'paid'
            ? `Record the next installment as paid for ${pendingAction.sip.id}.`
            : `This change applies to ${pendingAction?.sip.id}.`}
        confirmLabel={pendingAction?.type === 'skip' ? 'Skip installment' : pendingAction?.type === 'paid' ? 'Mark paid' : pendingAction?.status === 'Paused' ? 'Pause plan' : pendingAction?.status === 'Cancelled' ? 'Cancel plan' : 'Resume plan'}
        destructive={pendingAction?.type === 'skip' || pendingAction?.status === 'Cancelled'}
        onCancel={() => setPendingAction(null)}
        onConfirm={confirmAction}
      />
    </>
  );
}
