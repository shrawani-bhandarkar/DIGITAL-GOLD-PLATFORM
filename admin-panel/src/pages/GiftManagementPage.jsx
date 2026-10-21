import { useEffect, useMemo, useState } from 'react';
import { Gift, Mail, Plus, Search, Send, X } from 'lucide-react';
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
import useDocumentTitle from '../hooks/useDocumentTitle.js';

const PAGE_SIZE = 7;
const TODAY = '2026-10-15';

function formatDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(year, month - 1, day));
}

function oneYearAfter(value) {
  const [year, month, day] = value.split('-').map(Number);
  return `${year + 1}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function GiftManagementPage() {
  useDocumentTitle('Gift management');
  const { customers, products } = useManagement();
  const { gifts, addGift, updateGift, resendGift } = useOperations();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All statuses');
  const [metalFilter, setMetalFilter] = useState('All metals');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const [formError, setFormError] = useState('');
  const selectedGift = gifts.find((gift) => gift.id === selectedId);
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(() => gifts.filter((gift) => (
    [gift.id, gift.sender, gift.recipient, gift.recipientEmail, gift.metal].some((value) => value.toLowerCase().includes(normalizedQuery))
    && (statusFilter === 'All statuses' || gift.status === statusFilter)
    && (metalFilter === 'All metals' || gift.metal === metalFilter)
  )), [gifts, normalizedQuery, statusFilter, metalFilter]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  async function submitGift(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const sender = customers.find((customer) => customer.id === values.senderId);
    const product = products.find((item) => item.id === values.productId && item.status === 'Active');
    const amount = Number(values.amount);
    if (!sender || !product) {
      setFormError('Select a sender and an active metal product.');
      return;
    }
    if (!Number.isFinite(amount) || amount < product.minOrder || amount > product.maxOrder) {
      setFormError(`Gift value must be between ${formatCurrency(product.minOrder)} and ${formatCurrency(product.maxOrder)}.`);
      return;
    }
    if (!values.recipientEmail.trim() || !values.deliveryDate || values.deliveryDate < TODAY) {
      setFormError('Enter a recipient email and a delivery date today or later.');
      return;
    }
    const scheduled = values.deliveryDate > TODAY;
    const deliveryDate = formatDate(values.deliveryDate);
    const saved = await addGift({
      id: `GFT-2026-${String(Date.now()).slice(-5)}`, sender: sender.name,
      recipient: values.recipient.trim(), recipientEmail: values.recipientEmail.trim().toLowerCase(),
      metal: product.metal, purity: product.purity, amount, message: values.message.trim(),
      deliveryDate, expires: formatDate(oneYearAfter(values.deliveryDate)),
      status: scheduled ? 'Scheduled' : 'Delivered',
      timeline: [
        { label: 'Gift created (simulated)', time: '15 Oct, just now', done: true },
        { label: scheduled ? 'Scheduled gift email' : 'Gift email delivered (simulated)', time: scheduled ? deliveryDate : '15 Oct, just now', done: !scheduled },
        { label: 'Gift redeemed', time: 'Awaiting recipient', done: false },
      ],
    });
    if (!saved) { setFormError('Could not save the gift. Check the database connection and try again.'); return; }
    setPage(1);
    setFormOpen(false);
    setFormError('');
  }

  const columns = [
    { key: 'id', label: 'Gift', render: (value, row) => <button className="inline-table-link" onClick={() => setSelectedId(row.id)}><strong>{value}</strong><small>{row.deliveryDate}</small></button> },
    { key: 'sender', label: 'Sender', render: (value) => <span className="gift-person"><Gift size={14} />{value}</span> },
    { key: 'recipient', label: 'Recipient', render: (value, row) => <div className="management-secondary"><strong>{value}</strong><small>{row.recipientEmail}</small></div> },
    { key: 'metal', label: 'Gift asset', render: (value, row) => <div className="management-secondary"><strong>{formatCurrency(row.amount)}</strong><small>{value} · {row.purity}</small></div> },
    { key: 'status', label: 'Status', render: (value) => <StatusBadge status={value} /> },
    { key: 'actions', label: 'Actions', render: (_, row) => <div className="table-row-actions">{row.status === 'Scheduled' && <button className="text-action text-action-danger" onClick={() => setConfirmation({ gift: row, action: 'cancel' })}>Cancel</button>}{row.status === 'Delivered' && <button className="text-action" onClick={() => setConfirmation({ gift: row, action: 'resend' })}>Resend</button>}<button className="table-action-link" onClick={() => setSelectedId(row.id)} aria-label={`View ${row.id}`}>View</button></div> },
  ];

  return (
    <>
      <PageHeader eyebrow="CUSTOMER GIFTING" title="Gift management" description="Manage simulated digital metal gifts, delivery schedules, and recipient activity." actions={<button className="button button-primary" onClick={() => { setFormError(''); setFormOpen(true); }}><Plus size={15} /> Create gift</button>} />
      <SimulatedBanner>Gift records and status changes are stored in MySQL. No payment is taken and no message is sent.</SimulatedBanner>
      <section className="management-stat-grid">
        <article><span className="management-stat-icon stat-icon-teal"><Gift size={17} /></span><div><span>Total gifts</span><strong>{gifts.length}</strong></div></article>
        <article><span className="management-stat-icon stat-icon-blue"><Send size={17} /></span><div><span>Scheduled</span><strong>{gifts.filter((gift) => gift.status === 'Scheduled').length}</strong></div></article>
        <article><span className="management-stat-icon stat-icon-amber"><Mail size={17} /></span><div><span>Awaiting redemption</span><strong>{gifts.filter((gift) => gift.status === 'Delivered').length}</strong></div></article>
      </section>
      <section className="panel management-panel">
        <div className="management-toolbar">
          <label className="management-search"><Search size={16} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search gift, sender or recipient" aria-label="Search gifts" /></label>
          <div className="management-filters">
            <select value={metalFilter} onChange={(event) => { setMetalFilter(event.target.value); setPage(1); }} aria-label="Filter gift metal"><option>All metals</option>{[...new Set(gifts.map((gift) => gift.metal))].map((metal) => <option key={metal}>{metal}</option>)}</select>
            <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} aria-label="Filter gift status"><option>All statuses</option><option>Scheduled</option><option>Delivered</option><option>Redeemed</option><option>Expired</option><option>Cancelled</option></select>
          </div>
        </div>
        <DataTable columns={columns} rows={rows} allRows={filtered} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
        <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
      </section>
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Create gift" description="Creates a stored gift record; it will not charge, send, or transfer anything.">
        <form className="management-form" onSubmit={submitGift}>
          <div className="form-grid">
            <label className="field-block"><span>Sender</span><select name="senderId" required defaultValue=""><option value="" disabled>Select sender</option>{customers.filter((customer) => customer.status === 'Active').map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
            <label className="field-block"><span>Metal product</span><select name="productId" required defaultValue=""><option value="" disabled>Select product</option>{products.filter((product) => product.status === 'Active').map((product) => <option key={product.id} value={product.id}>{product.name} · {product.purity}</option>)}</select></label>
            <label className="field-block"><span>Recipient name</span><input name="recipient" required minLength="2" maxLength="80" placeholder="Recipient full name" /></label>
            <label className="field-block"><span>Recipient email</span><input name="recipientEmail" type="email" required maxLength="120" placeholder="recipient@example.com" /></label>
            <label className="field-block"><span>Gift value (₹)</span><input name="amount" type="number" min="1" step="0.01" required placeholder="2500" /></label>
            <label className="field-block"><span>Delivery date</span><input name="deliveryDate" type="date" min={TODAY} required defaultValue={TODAY} /></label>
            <label className="field-block form-grid-full"><span>Gift message <small className="optional-label">(optional, max 160 characters)</small></span><textarea name="message" rows="3" maxLength="160" placeholder="Add a personal note" /></label>
          </div>
          {formError && <p className="form-feedback" role="alert">{formError}</p>}
          <div className="form-actions"><button type="button" className="button button-secondary" onClick={() => setFormOpen(false)}>Cancel</button><button type="submit" className="button button-primary">Create demo gift</button></div>
        </form>
      </Modal>
      <Modal open={Boolean(selectedGift)} onClose={() => setSelectedId('')} title={selectedGift?.id ?? 'Gift details'} description="Delivery and redemption history · simulated">
        {selectedGift && <><div className="gift-detail-summary"><div><strong>{formatCurrency(selectedGift.amount)} {selectedGift.metal}</strong><span>{selectedGift.purity} · expires {selectedGift.expires}</span></div><StatusBadge status={selectedGift.status} /></div><dl className="redemption-address"><dt>Sender</dt><dd>{selectedGift.sender}</dd><dt>Recipient</dt><dd>{selectedGift.recipient} · {selectedGift.recipientEmail}</dd><dt>Delivery date</dt><dd>{selectedGift.deliveryDate}</dd><dt>Message</dt><dd>{selectedGift.message || 'No message provided'}</dd></dl><StatusTimeline items={selectedGift.timeline} /></>}
      </Modal>
      <ConfirmDialog open={Boolean(confirmation)} title={confirmation?.action === 'cancel' ? 'Cancel scheduled gift?' : 'Resend gift email?'} description={confirmation?.action === 'cancel' ? `${confirmation?.gift.id} will be marked cancelled in demo state.` : `A simulated resend event will be recorded for ${confirmation?.gift.id}. No email will be sent.`} confirmLabel={confirmation?.action === 'cancel' ? 'Cancel gift' : 'Record resend'} destructive={confirmation?.action === 'cancel'} onCancel={() => setConfirmation(null)} onConfirm={() => { if (confirmation.action === 'cancel') updateGift(confirmation.gift.id, 'Cancelled'); else resendGift(confirmation.gift.id); setConfirmation(null); }} />
    </>
  );
}
