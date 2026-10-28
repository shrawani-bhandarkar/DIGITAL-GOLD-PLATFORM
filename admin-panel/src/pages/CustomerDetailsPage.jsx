import { useEffect, useState } from 'react';
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
  const { customers, products, ledgerEntries, updateCustomer, fetchCustomerKyc, reviewCustomerKyc } = useManagement();
  const customer = customers.find((item) => item.id === customerId);
  const [kycDocuments, setKycDocuments] = useState([]);
  const [kycLoading, setKycLoading] = useState(true);
  const [kycError, setKycError] = useState('');
  const [selectedDocumentType, setSelectedDocumentType] = useState('aadhaar');
  const [documentNumber, setDocumentNumber] = useState('');
  const [documentVisible, setDocumentVisible] = useState(false);
  const [reviewingKyc, setReviewingKyc] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);
  const [confirmAccountChange, setConfirmAccountChange] = useState(false);
  useDocumentTitle(customer ? customer.name : 'Customer not found');

  useEffect(() => {
    let active = true;
    setKycLoading(true);
    fetchCustomerKyc(customerId)
      .then((documents) => {
        if (!active) return;
        setKycDocuments(documents);
        const selectedType = documents[0]?.documentType ?? 'aadhaar';
        setSelectedDocumentType(selectedType);
        setDocumentNumber(documents.find((document) => document.documentType === selectedType)?.documentNumber ?? '');
        setKycError('');
      })
      .catch((error) => { if (active) setKycError(error.message); })
      .finally(() => { if (active) setKycLoading(false); });
    return () => { active = false; };
  }, [customerId, fetchCustomerKyc]);

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

  const selectedDocument = kycDocuments.find((document) => document.documentType === selectedDocumentType);

  async function reviewKyc(status) {
    if (!documentNumber.trim() || reviewingKyc) return;
    setReviewingKyc(true);
    setKycError('');
    try {
      const result = await reviewCustomerKyc(customer.id, selectedDocumentType, documentNumber, status);
      const savedDocument = {
        documentType: selectedDocumentType,
        documentNumber: documentNumber.trim(),
        status: result.documentStatus,
        submittedAt: new Date().toISOString(),
        reviewedAt: status === 'Pending' ? null : new Date().toISOString(),
      };
      setKycDocuments((documents) => [
        ...documents.filter((document) => document.documentType !== selectedDocumentType),
        savedDocument,
      ]);
      setDocumentNumber(savedDocument.documentNumber);
      setConfirmReject(false);
    } catch (error) {
      setKycError(error.message);
    } finally {
      setReviewingKyc(false);
    }
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
            <div><ShieldCheck size={16} /><span><small>Existing PAN on profile</small><strong>{customer.pan || 'Not provided'}</strong></span></div>
          </div>
          <section className="customer-kyc-review">
            <div className="panel-heading"><div><h3>KYC Details</h3><p>Enter the customer’s Aadhaar or PAN number. Document details are encrypted in MySQL and available only to authorized customer reviewers.</p></div></div>
            {kycLoading ? <p className="empty-state" role="status">Loading saved KYC details…</p> : null}
            <label className="field-block">
              <span>Document type</span>
              <select
                aria-label="KYC document type"
                value={selectedDocumentType}
                onChange={(event) => {
                  const nextType = event.target.value;
                  setSelectedDocumentType(nextType);
                  setDocumentNumber(kycDocuments.find((document) => document.documentType === nextType)?.documentNumber ?? '');
                  setDocumentVisible(false);
                  setKycError('');
                }}
              >
                <option value="aadhaar">Aadhaar Card</option>
                <option value="pan">PAN Card</option>
              </select>
            </label>
            <label className="field-block">
              <span>{selectedDocumentType === 'aadhaar' ? 'Aadhaar number' : 'PAN number'}</span>
              <input
                aria-label={selectedDocumentType === 'aadhaar' ? 'Aadhaar number' : 'PAN number'}
                autoComplete="off"
                maxLength={selectedDocumentType === 'aadhaar' ? 12 : 10}
                onChange={(event) => setDocumentNumber(selectedDocumentType === 'pan' ? event.target.value.toUpperCase() : event.target.value.replace(/\D/g, ''))}
                placeholder={selectedDocumentType === 'aadhaar' ? 'Enter 12-digit Aadhaar number' : 'Enter PAN number'}
                type={documentVisible ? 'text' : 'password'}
                value={documentNumber}
              />
            </label>
            <button className="text-action" type="button" onClick={() => setDocumentVisible((visible) => !visible)}>{documentVisible ? 'Hide number' : 'Show number'}</button>
            {selectedDocument ? <p className="reviewed-note">Current status: {selectedDocument.status}</p> : null}
            <div className="review-actions">
              <button className="button button-secondary" disabled={reviewingKyc || !documentNumber.trim()} onClick={() => reviewKyc('Pending')}>{reviewingKyc ? 'Saving…' : 'Save details'}</button>
              <button className="button button-secondary button-reject" disabled={reviewingKyc || !documentNumber.trim()} onClick={() => setConfirmReject(true)}>Reject KYC</button>
              <button className="button button-primary" disabled={reviewingKyc || !documentNumber.trim()} onClick={() => reviewKyc('Approved')}><BadgeCheck size={15} /> {reviewingKyc ? 'Saving…' : 'Approve KYC'}</button>
            </div>
            {selectedDocument?.submittedAt ? <p className="form-hint">Last updated {new Date(selectedDocument.submittedAt).toLocaleString()}.</p> : null}
            {kycError ? <p className="form-feedback" role="alert">{kycError}</p> : null}
          </section>
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
      <ConfirmDialog open={confirmReject} title="Reject KYC?" description={`This will reject the entered ${selectedDocumentType === 'aadhaar' ? 'Aadhaar Card' : 'PAN Card'} details for ${customer.name}.`} confirmLabel="Reject KYC" destructive onCancel={() => setConfirmReject(false)} onConfirm={() => reviewKyc('Rejected')} />
      <ConfirmDialog open={confirmAccountChange} title={`${customer.status === 'Active' ? 'Suspend' : 'Restore'} customer account?`} description={`${customer.name}'s account access will be ${customer.status === 'Active' ? 'suspended' : 'restored'} in the demo.`} confirmLabel={customer.status === 'Active' ? 'Suspend account' : 'Restore account'} destructive={customer.status === 'Active'} onCancel={() => setConfirmAccountChange(false)} onConfirm={toggleAccountStatus} />
    </>
  );
}
