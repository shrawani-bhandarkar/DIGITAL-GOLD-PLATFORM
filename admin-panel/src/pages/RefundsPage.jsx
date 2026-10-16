import { useEffect, useMemo, useState } from 'react';
import { Download, Search, ShieldAlert } from 'lucide-react';
import DataTable from '../components/DataTable.jsx';
import PageHeader from '../components/PageHeader.jsx';
import Pagination from '../components/Pagination.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import SimulatedBanner from '../components/SimulatedBanner.jsx';
import { useOperations } from '../context/OperationsContext.jsx';
import { useAdmin } from '../context/AdminContext.jsx';
import { formatCurrency } from '../utils/formatters.js';
import { dateRangeMatches, downloadCsv, formatDateLabel } from '../utils/csvExport.js';
import { formatPaise, sumMoneyPaise } from '../utils/financial.js';
import useDocumentTitle from '../hooks/useDocumentTitle.js';

const PAGE_SIZE = 7;
const CSV_COLUMNS = [
  { label: 'Refund request ID', value: (row) => row.id },
  { label: 'Payment ID', value: (row) => row.paymentId },
  { label: 'Order ID', value: (row) => row.orderId },
  { label: 'Customer', value: (row) => row.customer },
  { label: 'Method', value: (row) => row.method },
  { label: 'Amount (INR)', value: (row) => row.amount },
  { label: 'Reason', value: (row) => row.reason },
  { label: 'Status', value: (row) => row.status },
  { label: 'Date', value: (row) => row.date },
];

export default function RefundsPage() {
  useDocumentTitle('Refunds');
  const { refunds, reviewRefund } = useOperations();
  const { recordAudit } = useAdmin();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All statuses');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [confirmation, setConfirmation] = useState(null);
  const invalidRange = Boolean(startDate && endDate && startDate > endDate);
  const term = query.trim().toLowerCase();
  const filtered = useMemo(() => refunds.filter((refund) => (
    [refund.id, refund.paymentId, refund.orderId, refund.customer, refund.reason].some((value) => value.toLowerCase().includes(term))
    && (statusFilter === 'All statuses' || refund.status === statusFilter)
    && dateRangeMatches(refund.date, startDate, endDate)
  )), [refunds, term, statusFilter, startDate, endDate]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = invalidRange ? [] : filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);
  const pendingTotalPaise = sumMoneyPaise(filtered.filter((refund) => refund.status === 'Pending review').map((refund) => refund.amount), 'Pending refund total');
  function exportRefunds() {
    downloadCsv('digital-gold-refunds.csv', CSV_COLUMNS, filtered);
    recordAudit({ action: 'Exported refund report', category: 'Reports', target: 'digital-gold-refunds.csv', detail: `${filtered.length} filtered demo refund rows downloaded locally.`, outcome: 'Completed' });
  }

  const columns = [
    { key: 'id', label: 'Refund request', render: (value, row) => <div className="management-secondary"><strong>{value}</strong><small>{row.date} · {row.time}</small></div> },
    { key: 'paymentId', label: 'Payment / order', render: (value, row) => <div className="management-secondary"><strong>{value}</strong><small>{row.orderId}</small></div> },
    { key: 'customer', label: 'Customer' },
    { key: 'reason', label: 'Reason' },
    { key: 'amount', label: 'Requested', align: 'right', render: (value) => <strong>{formatCurrency(value)}</strong> },
    { key: 'status', label: 'Review status', render: (value) => <StatusBadge status={value} /> },
    { key: 'actions', label: 'Actions', render: (_, row) => row.status === 'Pending review' ? <div className="table-row-actions"><button className="text-action" onClick={() => setConfirmation({ refund: row, status: 'Approved' })}>Approve request</button><button className="text-action text-action-danger" onClick={() => setConfirmation({ refund: row, status: 'Rejected' })}>Reject</button></div> : <span className="table-muted">{row.reviewNote ?? 'Decision recorded'}</span> },
  ];

  return (
    <>
      <PageHeader eyebrow="FINANCIAL OPERATIONS · DEMO RECORDS" title="Refund requests" description="Review sample refund requests and decisions without initiating a refund." actions={<button className="button button-secondary" onClick={exportRefunds}><Download size={15} /> Export filtered CSV</button>} />
      <SimulatedBanner>Approving or rejecting only changes a demo review label. It never sends, schedules, or simulates a real refund or payment.</SimulatedBanner>
      <section className="management-stat-grid">
        <article><span className="management-stat-icon stat-icon-amber"><ShieldAlert size={17} /></span><div><span>Pending requests</span><strong>{filtered.filter((refund) => refund.status === 'Pending review').length}</strong></div></article>
        <article><span className="management-stat-icon stat-icon-blue"><span className="stat-mini-dot" /></span><div><span>Pending sample value</span><strong>{formatPaise(pendingTotalPaise)}</strong></div></article>
        <article><span className="management-stat-icon stat-icon-teal"><span className="stat-mini-dot" /></span><div><span>Decisions recorded</span><strong>{filtered.filter((refund) => refund.status !== 'Pending review').length}</strong></div></article>
      </section>
      <section className="panel management-panel">
        <div className="management-toolbar">
          <label className="management-search"><Search size={16} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search request, payment, order or customer" aria-label="Search refund requests" /></label>
          <div className="management-filters"><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} aria-label="Filter refund status"><option>All statuses</option><option>Pending review</option><option>Approved</option><option>Completed</option><option>Rejected</option></select></div>
        </div>
        <div className="date-filter-row">
          <label>From <input type="date" value={startDate} max={endDate || undefined} onChange={(event) => { setStartDate(event.target.value); setPage(1); }} /></label>
          <label>To <input type="date" value={endDate} min={startDate || undefined} onChange={(event) => { setEndDate(event.target.value); setPage(1); }} /></label>
          {(startDate || endDate) && <button className="text-action" onClick={() => { setStartDate(''); setEndDate(''); setPage(1); }}>Clear dates</button>}
          <span>Approval records a decision only. It does not execute a refund.</span>
        </div>
        {invalidRange && <p className="filter-error" role="alert">Start date must be on or before end date.</p>}
        <DataTable columns={columns} rows={rows} allRows={invalidRange ? [] : filtered} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
        <Pagination page={page} pageSize={PAGE_SIZE} total={invalidRange ? 0 : filtered.length} onPageChange={setPage} />
      </section>
      <ConfirmDialog open={Boolean(confirmation)} title={`${confirmation?.status} refund request?`} description={`${confirmation?.refund.id} will be marked ${confirmation?.status.toLowerCase()} in this browser demo only. No financial transaction will be performed.`} confirmLabel={`${confirmation?.status} request`} destructive={confirmation?.status === 'Rejected'} onCancel={() => setConfirmation(null)} onConfirm={() => { reviewRefund(confirmation.refund.id, confirmation.status); setConfirmation(null); }} />
    </>
  );
}
