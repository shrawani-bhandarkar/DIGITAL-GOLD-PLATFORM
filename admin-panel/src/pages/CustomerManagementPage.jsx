import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, UserPlus, Users, BadgeCheck, Clock3, ArrowUpRight } from 'lucide-react';
import DataTable from '../components/DataTable.jsx';
import PageHeader from '../components/PageHeader.jsx';
import Pagination from '../components/Pagination.jsx';
import Modal from '../components/Modal.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { useManagement } from '../context/ManagementContext.jsx';
import { calculatePortfolio, calculateSellQuote, formatPaise, sumPaise } from '../utils/financial.js';
import useDocumentTitle from '../hooks/useDocumentTitle.js';

const PAGE_SIZE = 7;

export default function CustomerManagementPage() {
  useDocumentTitle('Customers');
  const { customers, customersLoading, products, ledgerEntries, addCustomer } = useManagement();
  const [query, setQuery] = useState('');
  const [kycFilter, setKycFilter] = useState('All verification statuses');
  const [accountFilter, setAccountFilter] = useState('All account statuses');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const portfolioValues = useMemo(() => {
    const holdings = calculatePortfolio(ledgerEntries);
    const values = new Map();
    for (const holding of holdings) {
      const product = products.find((item) => item.id === holding.productId);
      if (!product || holding.totalMilliGrams <= 0) continue;
      const valuation = calculateSellQuote({
        quantity: (holding.totalMilliGrams / 1000).toFixed(3),
        ratePerGram: product.sellRate,
      });
      values.set(holding.customerId, sumPaise([values.get(holding.customerId) ?? 0, valuation.grossPaise], 'Portfolio valuation'));
    }
    return values;
  }, [ledgerEntries, products]);

  const filteredCustomers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return customers.filter((customer) => {
      const matchesQuery = [customer.id, customer.name, customer.email, customer.phone, customer.city]
        .some((value) => value.toLowerCase().includes(normalized));
      return matchesQuery
        && (kycFilter === 'All verification statuses' || customer.kycStatus === kycFilter)
        && (accountFilter === 'All account statuses' || customer.status === accountFilter);
    });
  }, [customers, query, kycFilter, accountFilter]);
  const pageCount = Math.max(1, Math.ceil(filteredCustomers.length / PAGE_SIZE));
  const visibleCustomers = filteredCustomers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pendingCount = customers.filter((customer) => customer.kycStatus === 'Pending').length;
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  async function createCustomer(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = formData.get('name').trim();
    const email = formData.get('email').trim().toLowerCase();
    const phone = formData.get('phone').trim();
    const pan = formData.get('pan').trim().toUpperCase();
    if (customers.some((customer) => customer.email.toLowerCase() === email)) {
      setFormError('A customer with this email address already exists.');
      return;
    }
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) {
      setFormError('Enter a valid PAN, for example ABCDE1234F.');
      return;
    }
    const saved = await addCustomer({
      name,
      email,
      phone,
      pan,
      city: formData.get('city').trim(),
    });
    if (!saved) { setFormError('Could not save the customer. Check the database connection and try again.'); return; }
    setPage(1);
    setModalOpen(false);
    setFormError('');
  }

  const columns = [
    { key: 'name', label: 'Customer', render: (value, row) => <Link to={`/customers/${row.id}`} className="management-person"><span className="customer-avatar">{value.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><span><strong>{value}</strong><small>{row.id}</small></span></Link> },
    { key: 'email', label: 'Contact', render: (value, row) => <div className="management-secondary"><span>{value}</span><small>{row.phone}</small></div> },
    { key: 'city', label: 'City' },
    { key: 'kycStatus', label: 'Verification', render: (value) => <StatusBadge status={value} /> },
    { key: 'status', label: 'Account', render: (value) => <StatusBadge status={value} /> },
    { key: 'portfolioValue', label: 'Estimated value · demo', align: 'right', sortValue: (row) => portfolioValues.get(row.id) ?? 0, render: (_, row) => <strong>{formatPaise(portfolioValues.get(row.id) ?? 0)}</strong> },
    { key: 'action', label: '', render: (_, row) => <Link className="table-action-link" to={`/customers/${row.id}`} aria-label={`View ${row.name}`}><ArrowUpRight size={15} /></Link> },
  ];

  return (
    <>
      <PageHeader eyebrow="CUSTOMER OPERATIONS" title="Customers" description="Manage customer profiles, account status, and identity verification." actions={<button className="button button-primary" onClick={() => { setFormError(''); setModalOpen(true); }}><UserPlus size={15} /> Add customer</button>} />
      <div className="demo-data-banner"><span className="demo-data-pulse" /><strong>DATABASE</strong><span>Customer profiles and verification decisions are stored in MySQL.</span></div>
      <section className="management-stat-grid" aria-label="Customer metrics">
        <article><span className="management-stat-icon stat-icon-teal"><Users size={17} /></span><div><span>Total customers</span><strong>{customers.length.toLocaleString('en-IN')}</strong></div></article>
        <article><span className="management-stat-icon stat-icon-amber"><Clock3 size={17} /></span><div><span>Pending verification</span><strong>{pendingCount}</strong></div></article>
        <article><span className="management-stat-icon stat-icon-blue"><BadgeCheck size={17} /></span><div><span>Verified profiles</span><strong>{customers.filter((customer) => customer.kycStatus === 'Verified').length}</strong></div></article>
      </section>
      <section className="panel management-panel">
        <div className="management-toolbar">
          <label className="management-search"><Search size={16} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search name, email, phone or ID" aria-label="Search customers" /></label>
          <div className="management-filters">
            <select value={kycFilter} onChange={(event) => { setKycFilter(event.target.value); setPage(1); }} aria-label="Filter by verification status">
              <option>All verification statuses</option><option>Pending</option><option>Verified</option><option>Rejected</option>
            </select>
            <select value={accountFilter} onChange={(event) => { setAccountFilter(event.target.value); setPage(1); }} aria-label="Filter by account status">
              <option>All account statuses</option><option>Active</option><option>Suspended</option>
            </select>
          </div>
        </div>
        {customersLoading
          ? <p className="empty-state" role="status">Loading customer profiles…</p>
          : <>
            <DataTable columns={columns} rows={visibleCustomers} allRows={filteredCustomers} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} rowKey="id" />
            <Pagination page={page} pageSize={PAGE_SIZE} total={filteredCustomers.length} onPageChange={setPage} />
          </>}
      </section>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add customer" description="Create a customer profile. New profiles start with pending identity verification.">
        <form className="management-form" onSubmit={createCustomer}>
          <div className="form-grid">
            <label className="field-block"><span>Full name</span><input name="name" required minLength="2" maxLength="80" autoComplete="name" placeholder="e.g. Priya Kapoor" /></label>
            <label className="field-block"><span>Email address</span><input name="email" type="email" required maxLength="120" autoComplete="email" placeholder="name@example.com" /></label>
            <label className="field-block"><span>Phone number</span><input name="phone" type="tel" required pattern="^\+?[0-9 ]{10,16}$" title="Enter a valid 10–16 digit phone number" autoComplete="tel" placeholder="+91 98765 43210" /></label>
            <label className="field-block"><span>City</span><input name="city" required maxLength="60" autoComplete="address-level2" placeholder="City" /></label>
            <label className="field-block form-grid-full"><span>PAN</span><input name="pan" required pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]" maxLength="10" title="Enter a valid PAN, for example ABCDE1234F" placeholder="ABCDE1234F" /></label>
          </div>
          {formError && <p className="form-feedback" role="alert">{formError}</p>}
          <div className="form-actions"><button type="button" className="button button-secondary" onClick={() => setModalOpen(false)}>Cancel</button><button type="submit" className="button button-primary">Create customer</button></div>
        </form>
      </Modal>
    </>
  );
}
