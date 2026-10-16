import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Download, FileSpreadsheet, Search } from 'lucide-react';
import DataTable from '../components/DataTable.jsx';
import PageHeader from '../components/PageHeader.jsx';
import Pagination from '../components/Pagination.jsx';
import SimulatedBanner from '../components/SimulatedBanner.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { useOperations } from '../context/OperationsContext.jsx';
import { useAdmin } from '../context/AdminContext.jsx';
import { formatCurrency } from '../utils/formatters.js';
import { dateRangeMatches, downloadCsv, formatDateLabel } from '../utils/csvExport.js';
import { calculateReconciliationDifference, formatPaise, mockOrderDateKey, parseMoneyPaise, sumPaise } from '../utils/financial.js';
import useDocumentTitle from '../hooks/useDocumentTitle.js';

const PAGE_SIZE = 10;
const REPORT_TYPES = ['Payments', 'Refunds', 'Settlements', 'Orders'];

function reportRecords(type, data) {
  if (type === 'Payments') return data.payments.map((row) => ({ id: row.id, reference: row.orderId, party: row.customer, category: row.method, amount: row.amount, status: row.status, date: row.date, detail: row.providerRef }));
  if (type === 'Refunds') return data.refunds.map((row) => ({ id: row.id, reference: row.paymentId, party: row.customer, category: row.reason, amount: row.amount, status: row.status, date: row.date, detail: row.orderId }));
  if (type === 'Settlements') return data.settlements.map((row) => ({ id: row.id, reference: row.settlementRef, party: row.provider, category: `${row.transactions} entries`, amount: calculateReconciliationDifference(row.expected, row.settled) / 100, status: row.status, date: row.date, detail: row.note }));
  return data.orders.map((row) => {
    const date = mockOrderDateKey(row.placedAt);
    return { id: row.id, reference: row.customerId, party: row.customer, category: `${row.type} ${row.metal} · ${row.quantity} g`, amount: row.amount, status: row.status, date, detail: row.payment };
  });
}

const CSV_COLUMNS = [
  { label: 'Record ID', value: (row) => row.id },
  { label: 'Reference', value: (row) => row.reference },
  { label: 'Customer / provider', value: (row) => row.party },
  { label: 'Category', value: (row) => row.category },
  { label: 'Amount / variance (INR)', value: (row) => row.amount },
  { label: 'Status', value: (row) => row.status },
  { label: 'Date', value: (row) => row.date },
  { label: 'Details', value: (row) => row.detail },
];

export default function ReportsPage() {
  useDocumentTitle('Reports');
  const data = useOperations();
  const { recordAudit } = useAdmin();
  const [reportType, setReportType] = useState('Payments');
  const [statusFilter, setStatusFilter] = useState('All statuses');
  const [query, setQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const records = useMemo(() => reportRecords(reportType, data), [reportType, data]);
  const statuses = [...new Set(records.map((row) => row.status))];
  const invalidRange = Boolean(startDate && endDate && startDate > endDate);
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(() => records.filter((row) => (
    [row.id, row.reference, row.party, row.category, row.detail].some((value) => value.toLowerCase().includes(normalizedQuery))
    && (statusFilter === 'All statuses' || row.status === statusFilter)
    && dateRangeMatches(row.date, startDate, endDate)
  )), [records, normalizedQuery, statusFilter, startDate, endDate]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = invalidRange ? [] : filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { setPage(1); }, [reportType, statusFilter, query, startDate, endDate]);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);
  const sampleValuePaise = sumPaise(filtered.map((record) => (
    Math.sign(record.amount) * parseMoneyPaise(Math.abs(record.amount), 'Report amount', true)
  )), 'Report total');
  function exportReport() {
    const filename = `digital-gold-${reportType.toLowerCase()}-report.csv`;
    downloadCsv(filename, CSV_COLUMNS, filtered);
    recordAudit({ action: 'Exported report', category: 'Reports', target: filename, detail: `${filtered.length} filtered ${reportType.toLowerCase()} demo rows downloaded locally.`, outcome: 'Completed' });
  }

  const columns = [
    { key: 'id', label: 'Record', render: (value, row) => <div className="management-secondary"><strong>{value}</strong><small>{formatDateLabel(row.date)}</small></div> },
    { key: 'reference', label: 'Reference', render: (value) => <span className="finance-mono">{value}</span> },
    { key: 'party', label: 'Customer / provider' },
    { key: 'category', label: 'Category', render: (value) => <span className="report-category">{value}</span> },
    { key: 'amount', label: reportType === 'Settlements' ? 'Variance' : 'Amount', align: 'right', render: (value) => <span className={reportType === 'Settlements' && value !== 0 ? 'recon-mismatch' : ''}>{reportType === 'Settlements' ? formatPaise(parseMoneyPaise(Math.abs(value), 'Report variance', true) * Math.sign(value)) : formatCurrency(value)}</span> },
    { key: 'status', label: 'Status', render: (value) => <StatusBadge status={value} /> },
  ];

  function changeReportType(type) {
    setReportType(type);
    setStatusFilter('All statuses');
    setPage(1);
  }

  return (
    <>
      <PageHeader eyebrow="ANALYTICS · DEMO DATA" title="Reports" description="Filter operational records and export the matching sample data as CSV." actions={<button className="button button-primary" onClick={exportReport} disabled={invalidRange || filtered.length === 0}><Download size={15} /> Export filtered CSV</button>} />
      <SimulatedBanner>Reports contain mock operational data only. CSV exports are local downloads and must not be used as statements, settlement instructions, or financial records.</SimulatedBanner>
      <div className="report-type-tabs" role="tablist" aria-label="Report category">{REPORT_TYPES.map((type) => <button role="tab" aria-selected={reportType === type} className={reportType === type ? 'selected' : ''} key={type} onClick={() => changeReportType(type)}><FileSpreadsheet size={14} />{type}</button>)}</div>
      <section className="management-stat-grid">
        <article><span className="management-stat-icon stat-icon-teal"><BarChart3 size={17} /></span><div><span>Filtered records</span><strong>{invalidRange ? 0 : filtered.length}</strong></div></article>
        <article><span className="management-stat-icon stat-icon-blue"><span className="stat-mini-dot" /></span><div><span>{reportType === 'Settlements' ? 'Net variance' : 'Sample value total'}</span><strong>{formatPaise(sampleValuePaise)}</strong></div></article>
        <article><span className="management-stat-icon stat-icon-amber"><Download size={17} /></span><div><span>Export scope</span><strong className="report-stat-label">Filtered rows</strong></div></article>
      </section>
      <section className="panel management-panel">
        <div className="management-toolbar">
          <label className="management-search"><Search size={16} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder={`Search ${reportType.toLowerCase()} records`} aria-label="Search report records" /></label>
          <div className="management-filters"><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} aria-label="Filter report status"><option>All statuses</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select></div>
        </div>
        <div className="date-filter-row">
          <label>From <input type="date" value={startDate} max={endDate || undefined} onChange={(event) => { setStartDate(event.target.value); setPage(1); }} /></label>
          <label>To <input type="date" value={endDate} min={startDate || undefined} onChange={(event) => { setEndDate(event.target.value); setPage(1); }} /></label>
          {(startDate || endDate) && <button className="text-action" onClick={() => { setStartDate(''); setEndDate(''); setPage(1); }}>Clear dates</button>}
          <span>CSV contains all records matching these filters.</span>
        </div>
        {invalidRange && <p className="filter-error" role="alert">Start date must be on or before end date.</p>}
        <DataTable columns={columns} rows={rows} allRows={invalidRange ? [] : filtered} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
        <Pagination page={page} pageSize={PAGE_SIZE} total={invalidRange ? 0 : filtered.length} onPageChange={setPage} />
      </section>
    </>
  );
}
