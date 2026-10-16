import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CreditCard, Download, Search } from 'lucide-react';
import DataTable from '../components/DataTable.jsx';
import PageHeader from '../components/PageHeader.jsx';
import Pagination from '../components/Pagination.jsx';
import Modal from '../components/Modal.jsx';
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
  { label: 'Payment ID', value: (row) => row.id },
  { label: 'Order ID', value: (row) => row.orderId },
  { label: 'Customer', value: (row) => row.customer },
  { label: 'Method', value: (row) => row.method },
  { label: 'Amount (INR)', value: (row) => row.amount },
  { label: 'Provider reference (demo)', value: (row) => row.providerRef },
  { label: 'Status', value: (row) => row.status },
  { label: 'Date', value: (row) => row.date },
  { label: 'Time', value: (row) => row.time },
];

export default function PaymentsPage() {
  useDocumentTitle('Payments');
  const { payments } = useOperations();
  const { recordAudit } = useAdmin();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All statuses');
  const [methodFilter, setMethodFilter] = useState('All methods');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const rangeInvalid = Boolean(startDate && endDate && startDate > endDate);
  const term = query.trim().toLowerCase();
  const filtered = useMemo(() => payments.filter((payment) => (
    [payment.id, payment.orderId, payment.customer, payment.providerRef].some((value) => value.toLowerCase().includes(term))
    && (statusFilter === 'All statuses' || payment.status === statusFilter)
    && (methodFilter === 'All methods' || payment.method === methodFilter)
    && dateRangeMatches(payment.date, startDate, endDate)
  )), [payments, term, statusFilter, methodFilter, startDate, endDate]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = rangeInvalid ? [] : filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);
  const successfulTotalPaise = sumMoneyPaise(filtered.filter((payment) => payment.status === 'Successful').map((payment) => payment.amount), 'Successful payment total');
  function exportPayments() {
    downloadCsv('digital-gold-payments.csv', CSV_COLUMNS, filtered);
    recordAudit({ action: 'Exported payment report', category: 'Reports', target: 'digital-gold-payments.csv', detail: `${filtered.length} filtered demo payment rows downloaded locally.` , outcome: 'Completed' });
  }
  function viewPayment(payment) {
    setSelectedPayment(payment);
    recordAudit({ action: 'Viewed payment record', category: 'Payments', target: payment.id, detail: 'Opened read-only synthetic payment details.', outcome: 'Viewed' });
  }

  const columns = [
    { key: 'id', label: 'Payment', render: (value, row) => <button className="inline-table-link" onClick={() => viewPayment(row)}><strong>{value}</strong><small>{row.date} · {row.time}</small></button> },
    { key: 'orderId', label: 'Order reference', render: (value) => <span className="finance-mono">{value}</span> },
    { key: 'customer', label: 'Customer' },
    { key: 'method', label: 'Method' },
    { key: 'amount', label: 'Amount', align: 'right', render: (value) => <strong>{formatCurrency(value)}</strong> },
    { key: 'providerRef', label: 'Provider ref', render: (value) => <span className="finance-mono">{value}</span> },
    { key: 'status', label: 'Status', render: (value) => <StatusBadge status={value} /> },
  ];

  return (
    <>
      <PageHeader eyebrow="FINANCIAL OPERATIONS · DEMO RECORDS" title="Payments" description="Review sample payment events and provider references. This screen cannot initiate or capture a payment." actions={<button className="button button-secondary" onClick={exportPayments}><Download size={15} /> Export filtered CSV</button>} />
      <SimulatedBanner>Payment records and provider references are synthetic. No payment, capture, settlement, or transfer is triggered here.</SimulatedBanner>
      <section className="management-stat-grid">
        <article><span className="management-stat-icon stat-icon-teal"><CreditCard size={17} /></span><div><span>Payment records</span><strong>{filtered.length}</strong></div></article>
        <article><span className="management-stat-icon stat-icon-blue"><span className="stat-mini-dot" /></span><div><span>Successful sample value</span><strong>{formatPaise(successfulTotalPaise)}</strong></div></article>
        <article><span className="management-stat-icon stat-icon-amber"><CalendarDays size={17} /></span><div><span>Pending / processing</span><strong>{filtered.filter((payment) => ['Pending', 'Processing'].includes(payment.status)).length}</strong></div></article>
      </section>
      <section className="panel management-panel">
        <div className="management-toolbar">
          <label className="management-search"><Search size={16} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search payment, order, customer or ref" aria-label="Search payments" /></label>
          <div className="management-filters">
            <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} aria-label="Filter payment status"><option>All statuses</option><option>Successful</option><option>Pending</option><option>Processing</option><option>Failed</option></select>
            <select value={methodFilter} onChange={(event) => { setMethodFilter(event.target.value); setPage(1); }} aria-label="Filter payment method"><option>All methods</option>{[...new Set(payments.map((payment) => payment.method))].map((method) => <option key={method}>{method}</option>)}</select>
          </div>
        </div>
        <div className="date-filter-row">
          <label>From <input type="date" value={startDate} max={endDate || undefined} onChange={(event) => { setStartDate(event.target.value); setPage(1); }} /></label>
          <label>To <input type="date" value={endDate} min={startDate || undefined} onChange={(event) => { setEndDate(event.target.value); setPage(1); }} /></label>
          {(startDate || endDate) && <button className="text-action" onClick={() => { setStartDate(''); setEndDate(''); setPage(1); }}>Clear dates</button>}
          <span>Export includes all filtered rows, not just this page.</span>
        </div>
        {rangeInvalid && <p className="filter-error" role="alert">Start date must be on or before end date.</p>}
        <DataTable columns={columns} rows={rows} allRows={rangeInvalid ? [] : filtered} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
        <Pagination page={page} pageSize={PAGE_SIZE} total={rangeInvalid ? 0 : filtered.length} onPageChange={setPage} />
      </section>
      <Modal open={Boolean(selectedPayment)} onClose={() => setSelectedPayment(null)} title={selectedPayment?.id ?? 'Payment details'} description="Read-only synthetic payment event">
        {selectedPayment && <dl className="finance-detail-list"><dt>Order reference</dt><dd>{selectedPayment.orderId}</dd><dt>Customer</dt><dd>{selectedPayment.customer}</dd><dt>Method</dt><dd>{selectedPayment.method}</dd><dt>Amount</dt><dd>{formatCurrency(selectedPayment.amount)} {selectedPayment.currency}</dd><dt>Provider reference</dt><dd>{selectedPayment.providerRef}</dd><dt>Status</dt><dd><StatusBadge status={selectedPayment.status} /></dd><dt>Recorded</dt><dd>{formatDateLabel(selectedPayment.date)} · {selectedPayment.time}</dd><dt>Operation</dt><dd>Read-only demo record. No payment action available.</dd></dl>}
      </Modal>
    </>
  );
}
