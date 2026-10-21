import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, Mail, MapPin, Phone, ShieldCheck, UserRound } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { useManagement } from '../context/ManagementContext.jsx';
import useDocumentTitle from '../hooks/useDocumentTitle.js';
import { calculatePortfolio, calculateSellQuote, formatGrams, formatPaise, sumPaise } from '../utils/financial.js';

export default function CustomerDetailsPage() {
  const { customerId } = useParams();
  const { customers, products, ledgerEntries, updateCustomer } = useManagement();
  const customer = customers.find((item) => item.id === customerId);
  const [confirmReject, setConfirmReject] = useState(false);
  const [confirmAccountChange, setConfirmAccountChange] = useState(false);
  useDocumentTitle(customer ? customer.name : 'Customer not found');

  if (!customer) {
    return <section className="panel not-found-panel"><h1>Customer not found</h1><p>This customer record may have been removed.</p><Link className="button button-primary" to="/customers">Back to customers</Link></section>;
  }

  const holdings = calculatePortfolio(ledgerEntries).filter((holding) => holding.customerId === customer.id && holding.totalMilliGrams > 0)
    .map((holding) => {
      const product = products.find((item) => item.id === holding.productId);
      const valuation = product && holding.totalMilliGrams > 0
        ? calculateSellQuote({ quantity: (holding.totalMilliGrams / 1000).toFixed(3), ratePerGram: product.sellRate })
        : null;
      return { ...holding, product, valuation };
    });
  const portfolioValuePaise = sumPaise(holdings.map((holding) => holding.valuation?.grossPaise ?? 0), 'Portfolio valuation');

  function reviewKyc(status) {
    updateCustomer(customer.id, { kycStatus: status });
    setConfirmReject(false);
  }

  function toggleAccountStatus() {
    updateCustomer(customer.id, { status: customer.status === 'Active' ? 'Suspended' : 'Active' });
    setConfirmAccountChange(false);
  }

  return (
    <>
      <PageHeader eyebrow={`CUSTOMER PROFILE · ${customer.id}`} title={customer.name} description="Review customer details and manage identity verification." actions={<Link to="/customers" className="button button-secondary"><ArrowLeft size={15} /> All customers</Link>} />
      <div className="demo-data-banner"><span className="demo-data-pulse" /><strong>DATABASE</strong><span>Customer details and verification history are loaded from MySQL.</span></div>
      <div className="customer-detail-layout">
        <section className="panel customer-profile-card">
          <div className="customer-profile-heading"><span className="customer-profile-avatar">{customer.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><div><h2>{customer.name}</h2><p>{customer.id} · Joined {customer.joined}</p></div></div>
          <div className="profile-badges"><StatusBadge status={customer.kycStatus} /><StatusBadge status={customer.status} /></div>
          <div className="profile-detail-list">
            <div><Mail size={16} /><span><small>Email address</small><strong>{customer.email}</strong></span></div>
            <div><Phone size={16} /><span><small>Phone number</small><strong>{customer.phone}</strong></span></div>
            <div><MapPin size={16} /><span><small>City</small><strong>{customer.city}</strong></span></div>
            <div><ShieldCheck size={16} /><span><small>PAN</small><strong>{customer.pan}</strong></span></div>
          </div>
          {customer.kycStatus === 'Pending' && <div className="review-actions"><button className="button button-secondary button-reject" onClick={() => setConfirmReject(true)}>Reject verification</button><button className="button button-primary" onClick={() => reviewKyc('Verified')}><BadgeCheck size={15} /> Approve KYC</button></div>}
          {customer.kycStatus !== 'Pending' && <p className="reviewed-note"><BadgeCheck size={15} /> Identity verification is {customer.kycStatus.toLowerCase()}.</p>}
          <div className="account-status-actions"><span>Account access</span><button className="text-action" onClick={() => setConfirmAccountChange(true)}>{customer.status === 'Active' ? 'Suspend account' : 'Restore account'}</button></div>
        </section>
        <div className="customer-overview-column">
          <section className="management-stat-grid customer-overview-stats">
            <article><span className="management-stat-icon stat-icon-teal"><UserRound size={17} /></span><div><span>Estimated portfolio value · demo</span><strong>{formatPaise(portfolioValuePaise)}</strong></div></article>
            <article><span className="management-stat-icon stat-icon-blue"><BadgeCheck size={17} /></span><div><span>Transactions</span><strong>{customer.transactions}</strong></div></article>
          </section>
          <section className="panel customer-activity-panel portfolio-panel">
            <div className="panel-heading"><div><h2>Metal holdings</h2><p>Ledger-derived quantities · estimated demo valuations at displayed sell rates</p></div></div>
            {holdings.length ? <div className="portfolio-holdings">{holdings.map((holding) => (
              <div className="portfolio-holding" key={holding.productId}>
                <div><strong>{holding.product?.name ?? holding.productId}</strong><small>{formatGrams(holding.totalMilliGrams)} total · {formatGrams(holding.availableMilliGrams)} available · {formatGrams(holding.reservedMilliGrams)} reserved</small></div>
                <strong>{formatPaise(holding.valuation?.grossPaise ?? 0)}</strong>
              </div>
            ))}</div> : <p className="empty-state">No demo metal holdings are available for this customer.</p>}
          </section>
          <section className="panel customer-activity-panel"><div className="panel-heading"><div><h2>Recent activity</h2><p>Sample account activity</p></div></div><div className="detail-activity-list"><div><span className="activity-marker teal-marker" /><span><strong>Customer profile created</strong><small>{customer.joined} · Account opened</small></span></div><div><span className={`activity-marker ${customer.kycStatus === 'Pending' ? 'amber-marker' : 'teal-marker'}`} /><span><strong>KYC {customer.kycStatus.toLowerCase()}</strong><small>Identity review status</small></span></div><div><span className="activity-marker blue-marker" /><span><strong>{customer.transactions} transactions</strong><small>Demo transaction history</small></span></div></div></section>
        </div>
      </div>
      <ConfirmDialog open={confirmReject} title="Reject KYC verification?" description={`This will mark ${customer.name}'s identity verification as rejected. You can review it again later.`} confirmLabel="Reject verification" destructive onCancel={() => setConfirmReject(false)} onConfirm={() => reviewKyc('Rejected')} />
      <ConfirmDialog open={confirmAccountChange} title={`${customer.status === 'Active' ? 'Suspend' : 'Restore'} customer account?`} description={`${customer.name}'s account access will be ${customer.status === 'Active' ? 'suspended' : 'restored'} in the demo.`} confirmLabel={customer.status === 'Active' ? 'Suspend account' : 'Restore account'} destructive={customer.status === 'Active'} onCancel={() => setConfirmAccountChange(false)} onConfirm={toggleAccountStatus} />
    </>
  );
}
