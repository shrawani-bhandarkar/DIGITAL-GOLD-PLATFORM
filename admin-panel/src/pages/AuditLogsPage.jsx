import { useEffect, useMemo, useState } from 'react';
import { Download, Search, ScrollText } from 'lucide-react';
import DataTable from '../components/DataTable.jsx';
import PageHeader from '../components/PageHeader.jsx';
import Pagination from '../components/Pagination.jsx';
import SimulatedBanner from '../components/SimulatedBanner.jsx';
import Modal from '../components/Modal.jsx';
import { useAdmin } from '../context/AdminContext.jsx';
import { dateRangeMatches, downloadCsv } from '../utils/csvExport.js';
import useDocumentTitle from '../hooks/useDocumentTitle.js';

const PAGE_SIZE = 10;
const CSV_COLUMNS = [
  { label: 'Event ID', value: (row) => row.id },
  { label: 'Timestamp', value: (row) => row.timestamp },
  { label: 'Actor', value: (row) => row.actor },
  { label: 'Action', value: (row) => row.action },
  { label: 'Category', value: (row) => row.category },
  { label: 'Target', value: (row) => row.target },
  { label: 'Detail', value: (row) => row.detail },
  { label: 'Outcome', value: (row) => row.outcome },
];

function eventDate(timestamp) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function timestampLabel(timestamp) {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp));
}

export default function AuditLogsPage() {
  useDocumentTitle('Audit logs');
  const { auditEvents, recordAudit } = useAdmin();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All categories');
  const [outcome, setOutcome] = useState('All outcomes');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const invalidRange = Boolean(startDate && endDate && startDate > endDate);
  const term = query.trim().toLowerCase();
  const filtered = useMemo(() => auditEvents.filter((event) => (
    [event.id, event.actor, event.action, event.category, event.target, event.detail].some((value) => value.toLowerCase().includes(term))
    && (category === 'All categories' || event.category === category)
    && (outcome === 'All outcomes' || event.outcome === outcome)
    && dateRangeMatches(eventDate(event.timestamp), startDate, endDate)
  )), [auditEvents, term, category, outcome, startDate, endDate]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = invalidRange ? [] : filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);
  const categories = [...new Set(auditEvents.map((event) => event.category))];
  const outcomes = [...new Set(auditEvents.map((event) => event.outcome))];
  function exportAuditLogs() {
    downloadCsv('digital-gold-audit-logs.csv', CSV_COLUMNS, filtered);
    recordAudit({ action: 'Exported audit log report', category: 'Audit logs', target: 'digital-gold-audit-logs.csv', detail: `${filtered.length} filtered demo events downloaded locally.`, outcome: 'Completed' });
  }

  const columns = [
    { key: 'timestamp', label: 'Timestamp', render: (value) => <span className="audit-timestamp">{timestampLabel(value)}</span> },
    { key: 'actor', label: 'Actor', render: (value) => <span className="audit-actor">{value}</span> },
    { key: 'action', label: 'Action' },
    { key: 'category', label: 'Category', render: (value) => <span className="audit-category">{value}</span> },
    { key: 'target', label: 'Target', render: (value) => <span className="finance-mono">{value}</span> },
    { key: 'outcome', label: 'Outcome', render: (value) => <span className={`audit-outcome ${value.toLowerCase()}`}>{value}</span> },
    { key: 'detail', label: '', render: (_, event) => <button className="table-action-link" onClick={() => setSelectedEvent(event)} aria-label={`View audit event ${event.id}`}>View</button> },
  ];

  return (
    <>
      <PageHeader eyebrow="ADMINISTRATION · LOCAL DEMO HISTORY" title="Audit logs" description="Inspect sample history and actions recorded during this browser session." actions={<button className="button button-secondary" onClick={exportAuditLogs} disabled={invalidRange || filtered.length === 0}><Download size={15} /> Export filtered CSV</button>} />
      <SimulatedBanner>Audit events are held in memory and can be cleared by reloading. They are not tamper-proof, durable, or a substitute for server-side security audit logging.</SimulatedBanner>
      <section className="management-stat-grid">
        <article><span className="management-stat-icon stat-icon-teal"><ScrollText size={17} /></span><div><span>Filtered events</span><strong>{invalidRange ? 0 : filtered.length}</strong></div></article>
        <article><span className="management-stat-icon stat-icon-blue"><span className="stat-mini-dot" /></span><div><span>Categories represented</span><strong>{new Set(filtered.map((event) => event.category)).size}</strong></div></article>
        <article><span className="management-stat-icon stat-icon-amber"><span className="stat-mini-dot" /></span><div><span>Current session events</span><strong>{auditEvents.length - 7}</strong></div></article>
      </section>
      <section className="panel management-panel">
        <div className="management-toolbar">
          <label className="management-search"><Search size={16} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search actor, action, target or detail" aria-label="Search audit events" /></label>
          <div className="management-filters">
            <select value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }} aria-label="Filter audit category"><option>All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</select>
            <select value={outcome} onChange={(event) => { setOutcome(event.target.value); setPage(1); }} aria-label="Filter audit outcome"><option>All outcomes</option>{outcomes.map((item) => <option key={item}>{item}</option>)}</select>
          </div>
        </div>
        <div className="date-filter-row">
          <label>From <input type="date" value={startDate} max={endDate || undefined} onChange={(event) => { setStartDate(event.target.value); setPage(1); }} /></label>
          <label>To <input type="date" value={endDate} min={startDate || undefined} onChange={(event) => { setEndDate(event.target.value); setPage(1); }} /></label>
          {(startDate || endDate) && <button className="text-action" onClick={() => { setStartDate(''); setEndDate(''); setPage(1); }}>Clear dates</button>}
          <span>Data is session-only and not tamper-proof.</span>
        </div>
        {invalidRange && <p className="filter-error" role="alert">Start date must be on or before end date.</p>}
        <DataTable columns={columns} rows={rows} allRows={invalidRange ? [] : filtered} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
        <Pagination page={page} pageSize={PAGE_SIZE} total={invalidRange ? 0 : filtered.length} onPageChange={setPage} />
      </section>
      <Modal open={Boolean(selectedEvent)} onClose={() => setSelectedEvent(null)} title="Audit event" description={selectedEvent?.id}>
        {selectedEvent && <dl className="finance-detail-list"><dt>Timestamp</dt><dd>{timestampLabel(selectedEvent.timestamp)}</dd><dt>Actor</dt><dd>{selectedEvent.actor}</dd><dt>Action</dt><dd>{selectedEvent.action}</dd><dt>Category</dt><dd>{selectedEvent.category}</dd><dt>Target</dt><dd>{selectedEvent.target}</dd><dt>Detail</dt><dd>{selectedEvent.detail}</dd><dt>Outcome</dt><dd>{selectedEvent.outcome}</dd></dl>}
      </Modal>
    </>
  );
}
