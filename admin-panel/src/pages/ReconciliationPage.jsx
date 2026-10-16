import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, Search } from 'lucide-react';
import DataTable from '../components/DataTable.jsx';
import PageHeader from '../components/PageHeader.jsx';
import Pagination from '../components/Pagination.jsx';
import Modal from '../components/Modal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import SimulatedBanner from '../components/SimulatedBanner.jsx';
import { useOperations } from '../context/OperationsContext.jsx';
import { useAdmin } from '../context/AdminContext.jsx';
import { formatCurrency } from '../utils/formatters.js';
import { dateRangeMatches, downloadCsv, formatDateLabel } from '../utils/csvExport.js';
import { calculateReconciliationDifference, formatPaise, sumPaise } from '../utils/financial.js';
import useDocumentTitle from '../hooks/useDocumentTitle.js';

const PAGE_SIZE = 7;
const CSV_COLUMNS = [
  { label: 'Settlement batch', value: (row) => row.id },
  { label: 'Provider', value: (row) => row.provider },
  { label: 'Settlement reference (demo)', value: (row) => row.settlementRef },
  { label: 'Transactions', value: (row) => row.transactions },
  { label: 'Expected (INR)', value: (row) => row.expected },
  { label: 'Settled (INR)', value: (row) => row.settled },
  { label: 'Difference (INR)', value: (row) => calculateReconciliationDifference(row.expected, row.settled) / 100 },
  { label: 'Status', value: (row) => reconciliationStatus(row) },
  { label: 'Date', value: (row) => row.date },
  { label: 'Note', value: (row) => row.note },
];

function reconciliationStatus(row) {
  if (row.status === 'Reviewed') return 'Reviewed';
  return calculateReconciliationDifference(row.expected, row.settled) === 0 ? 'Matched' : 'Mismatch';
}

export default function ReconciliationPage() {
  useDocumentTitle('Reconciliation');
  const { settlements, markSettlementReviewed } = useOperations();
  const { recordAudit } = useAdmin();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All statuses');
  const [providerFilter, setProviderFilter] = useState('All providers');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const invalidRange = Boolean(startDate && endDate && startDate > endDate);
  const term = query.trim().toLowerCase();
  const filtered = useMemo(() => settlements.filter((item) => (
    [item.id, item.provider, item.settlementRef, item.note].some((value) => value.toLowerCase().includes(term))
    && (statusFilter === 'All statuses' || reconciliationStatus(item) === statusFilter)
    && (providerFilter === 'All providers' || item.provider.startsWith(providerFilter))
    && dateRangeMatches(item.date, startDate, endDate)
  )), [settlements, term, statusFilter, providerFilter, startDate, endDate]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = invalidRange ? [] : filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);
  const outstandingPaise = sumPaise(filtered.map((item) => Math.abs(calculateReconciliationDifference(item.expected, item.settled))), 'Absolute reconciliation variance');
  function exportSettlements() {
    downloadCsv('digital-gold-reconciliation.csv', CSV_COLUMNS, filtered);
    recordAudit({ action: 'Exported reconciliation report', category: 'Reports', target: 'digital-gold-reconciliation.csv', detail: `${filtered.length} filtered demo settlement rows downloaded locally.`, outcome: 'Completed' });
  }

  const columns = [
    { key: 'id', label: 'Settlement batch', render: (value, row) => <button className="inline-table-link" onClick={() => setSelected(row)}><strong>{value}</strong><small>{formatDateLabel(row.date)}</small></button> },
    { key: 'provider', label: 'Provider' },
    { key: 'settlementRef', label: 'Settlement ref', render: (value) => <span className="finance-mono">{value}</span> },
    { key: 'transactions', label: 'Entries', align: 'right' },
    { key: 'expected', label: 'Expected', align: 'right', render: (value) => formatCurrency(value) },
    { key: 'settled', label: 'Settled', align: 'right', render: (value) => formatCurrency(value) },
    { key: 'difference', label: 'Difference', align: 'right', sortValue: (row) => calculateReconciliationDifference(row.expected, row.settled), render: (_, row) => { const difference = calculateReconciliationDifference(row.expected, row.settled); return <span className={difference === 0 ? 'recon-match' : 'recon-mismatch'}>{difference > 0 ? '+' : ''}{formatPaise(difference)}</span>; } },
    { key: 'status', label: 'Status', render: (_, row) => <StatusBadge status={reconciliationStatus(row)} /> },
    { key: 'actions', label: 'Review', render: (_, row) => reconciliationStatus(row) === 'Mismatch' ? <button className="text-action" onClick={() => setConfirmation(row)}>Mark reviewed</button> : <button className="table-action-link" onClick={() => setSelected(row)} aria-label={`View ${row.id}`}>View</button> },
  ];

  return (
    <>
      <PageHeader eyebrow="FINANCIAL OPERATIONS · SAMPLE SETTLEMENTS" title="Reconciliation" description="Compare mock provider settlement totals with sample platform records." actions={<button className="button button-secondary" onClick={exportSettlements}><Download size={15} /> Export filtered CSV</button>} />
      <SimulatedBanner>Settlement data is synthetic. Reviewing a mismatch only records an internal demo status; it never adjusts balances, sends money, or contacts a provider.</SimulatedBanner>
      <section className="management-stat-grid">
        <article><span className="management-stat-icon stat-icon-teal"><CheckCircle2 size={17} /></span><div><span>Matched batches</span><strong>{filtered.filter((item) => reconciliationStatus(item) === 'Matched').length}</strong></div></article>
        <article><span className="management-stat-icon stat-icon-red"><AlertTriangle size={17} /></span><div><span>Mismatches to review</span><strong>{filtered.filter((item) => reconciliationStatus(item) === 'Mismatch').length}</strong></div></article>
        <article><span className="management-stat-icon stat-icon-amber"><span className="stat-mini-dot" /></span><div><span>Absolute sample variance</span><strong>{formatPaise(outstandingPaise)}</strong></div></article>
      </section>
      <section className="panel management-panel">
        <div className="management-toolbar">
          <label className="management-search"><Search size={16} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search batch, provider or reference" aria-label="Search settlements" /></label>
          <div className="management-filters">
            <select value={providerFilter} onChange={(event) => { setProviderFilter(event.target.value); setPage(1); }} aria-label="Filter provider"><option>All providers</option><option>UPI</option><option>Card</option><option>Net banking</option><option>Wallet</option></select>
            <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} aria-label="Filter settlement status"><option>All statuses</option><option>Matched</option><option>Mismatch</option><option>Reviewed</option></select>
          </div>
        </div>
        <div className="date-filter-row">
          <label>From <input type="date" value={startDate} max={endDate || undefined} onChange={(event) => { setStartDate(event.target.value); setPage(1); }} /></label>
          <label>To <input type="date" value={endDate} min={startDate || undefined} onChange={(event) => { setEndDate(event.target.value); setPage(1); }} /></label>
          {(startDate || endDate) && <button className="text-action" onClick={() => { setStartDate(''); setEndDate(''); setPage(1); }}>Clear dates</button>}
          <span>Mismatch review is administrative annotation only.</span>
        </div>
        {invalidRange && <p className="filter-error" role="alert">Start date must be on or before end date.</p>}
        <DataTable columns={columns} rows={rows} allRows={invalidRange ? [] : filtered} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
        <Pagination page={page} pageSize={PAGE_SIZE} total={invalidRange ? 0 : filtered.length} onPageChange={setPage} />
      </section>
      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.id ?? 'Settlement details'} description="Mock settlement totals · no bank or provider connection">
        {selected && <><div className="settlement-detail-heading"><span>{selected.provider}</span><StatusBadge status={reconciliationStatus(selected)} /></div><dl className="finance-detail-list"><dt>Settlement reference</dt><dd>{selected.settlementRef}</dd><dt>Settlement date</dt><dd>{formatDateLabel(selected.date)}</dd><dt>Sample entries</dt><dd>{selected.transactions}</dd><dt>Expected total</dt><dd>{formatCurrency(selected.expected)}</dd><dt>Settled total</dt><dd>{formatCurrency(selected.settled)}</dd><dt>Variance (actual − expected)</dt><dd className={calculateReconciliationDifference(selected.expected, selected.settled) === 0 ? 'recon-match' : 'recon-mismatch'}>{formatPaise(calculateReconciliationDifference(selected.expected, selected.settled))}</dd><dt>Sample note</dt><dd>{selected.note}</dd></dl>{reconciliationStatus(selected) === 'Mismatch' && <div className="mismatch-callout"><AlertTriangle size={15} /> Verify source records outside this demo before taking any real-world action. This panel cannot alter settlement data.</div>}</>}
      </Modal>
      <ConfirmDialog open={Boolean(confirmation)} title="Mark mismatch reviewed?" description={`${confirmation?.id} will be labelled reviewed in this demo only. No balances, payment records, or settlement values will be changed.`} confirmLabel="Mark reviewed" onCancel={() => setConfirmation(null)} onConfirm={() => { markSettlementReviewed(confirmation.id); setSelected(null); setConfirmation(null); }} />
    </>
  );
}
