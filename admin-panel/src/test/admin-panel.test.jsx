// Runtime validation coverage for routed admin behavior and demo-only state.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import App from '../App.jsx';
import { AuthProvider } from '../context/AuthContext.jsx';

const STORAGE_KEY = 'digital-gold-demo-session';

function renderApp(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

async function goTo(path) {
  const link = document.querySelector(`aside nav a[href="${path}"]`);
  if (!link) throw new Error(`Sidebar link not found: ${path}`);
  await userEvent.click(link);
}

beforeEach(() => {
  window.localStorage.setItem(STORAGE_KEY, 'authenticated');
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('routing, authentication, and dashboard', () => {
  it.each([
    ['/', 'Good morning, Admin'],
    ['/customers', 'Customers'],
    ['/products', 'Metal products'],
    ['/rates', 'Rate management'],
    ['/orders', 'Buy & sell orders'],
    ['/sips', 'SIP management'],
    ['/redemptions', 'Redemption & delivery'],
    ['/gifts', 'Gift management'],
    ['/payments', 'Payments'],
    ['/refunds', 'Refund requests'],
    ['/reconciliation', 'Reconciliation'],
    ['/reports', 'Reports'],
    ['/roles', 'Roles & permissions'],
    ['/settings', 'Settings'],
    ['/audit-logs', 'Audit logs'],
    ['/customers/CUS-10482', 'Aarav Mehta'],
    ['/orders/ORD-2026-08421', 'Buy Gold'],
  ])('renders %s', (path, heading) => {
    renderApp(path);
    expect(screen.getByRole('heading', { name: heading, level: 1 })).toBeInTheDocument();
  });

  it('renders dashboard sample metrics and indicative rates', () => {
    renderApp('/');
    expect(screen.getByLabelText('Platform metrics')).toBeInTheDocument();
    expect(screen.getByLabelText('Indicative metal rates')).toBeInTheDocument();
    expect(screen.getByText('All rates, customer figures, and financial amounts on this dashboard are sample values for preview only.')).toBeInTheDocument();
    expect(screen.getByText('Unique completed orders · 30-day sample')).toBeInTheDocument();
    expect(screen.getByText(/payments are not double-counted/)).toBeInTheDocument();
    const rateCards = within(screen.getByLabelText('Indicative metal rates'));
    expect(rateCards.getByText('Gold')).toBeInTheDocument();
    expect(rateCards.getByText('Silver')).toBeInTheDocument();
    expect(rateCards.getByText('Platinum')).toBeInTheDocument();
    expect(rateCards.getByText('₹3,120')).toBeInTheDocument();
  });

  it('rejects invalid credentials and accepts demo credentials', async () => {
    window.localStorage.clear();
    const user = userEvent.setup();
    renderApp('/login');
    await user.type(screen.getByRole('textbox', { name: 'Email address' }), 'admin@digitalgold.demo');
    await user.type(screen.getByLabelText('Password', { selector: 'input' }), 'incorrect');
    await user.click(screen.getByRole('button', { name: /Sign in to workspace/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('Email or password is incorrect.');

    await user.clear(screen.getByLabelText('Password', { selector: 'input' }));
    await user.type(screen.getByLabelText('Password', { selector: 'input' }), 'GoldAdmin123!');
    await user.click(screen.getByRole('button', { name: /Sign in to workspace/ }));
    expect(await screen.findByRole('heading', { name: 'Good morning, Admin' })).toBeInTheDocument();
  });

  it('navigates by sidebar and protects routes after logout', async () => {
    const user = userEvent.setup();
    renderApp('/');
    await goTo('/reports');
    expect(screen.getByRole('heading', { name: 'Reports' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });
});

describe('management lists and forms', () => {
  it('sorts filtered table data before paginating and reverses sort direction', async () => {
    const user = userEvent.setup();
    renderApp('/customers');
    await user.click(screen.getByRole('button', { name: 'Sort by Customer' }));
    expect(screen.getAllByRole('row')[1]).toHaveTextContent('Aarav Mehta');
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(screen.getAllByRole('row')[1]).toHaveTextContent('Rohan Gupta');
    await user.click(screen.getByRole('button', { name: 'Sort by Customer' }));
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    expect(screen.getAllByRole('row')[1]).toHaveTextContent('Tara Bose');
  });

  it('searches, filters, paginates, validates, and creates a customer', async () => {
    const user = userEvent.setup();
    renderApp('/customers');
    expect(screen.getByRole('button', { name: 'Sort by Estimated value · demo' })).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Search customers' }), 'no matching customer');
    expect(screen.getByText('No records to display.')).toBeInTheDocument();
    await user.clear(screen.getByRole('textbox', { name: 'Search customers' }));
    await user.type(screen.getByRole('textbox', { name: 'Search customers' }), 'Aarav');
    expect(screen.getAllByRole('row')).toHaveLength(2);
    await user.clear(screen.getByRole('textbox', { name: 'Search customers' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter by verification status' }), 'Pending');
    expect(screen.getAllByRole('row')).toHaveLength(4);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter by verification status' }), 'All verification statuses');
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add customer' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Create customer' }).closest('form')).not.toBeValid();
    await user.type(within(dialog).getByLabelText('Full name'), 'Leela Rao');
    await user.type(within(dialog).getByLabelText('Email address'), 'leela@example.com');
    await user.type(within(dialog).getByLabelText('Phone number'), '+91 99999 12345');
    await user.type(within(dialog).getByLabelText('City'), 'Pune');
    await user.type(within(dialog).getByLabelText('PAN'), 'ABCDE1234F');
    await user.click(within(dialog).getByRole('button', { name: 'Create customer' }));
    expect(await screen.findByText('Leela Rao')).toBeInTheDocument();
  });

  it('confirms KYC decisions and account suspension/restore as demo-only actions', async () => {
    const user = userEvent.setup();
    renderApp('/customers/CUS-10482');
    await user.click(screen.getByRole('button', { name: 'Reject verification' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Reject verification' }));
    expect(screen.getByText('Identity verification is rejected.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Suspend account' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Suspend account' }));
    expect(screen.getByText('Suspended', { selector: '.status-badge' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Restore account' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Restore account' }));
    expect(screen.getByText('Active', { selector: '.status-badge' })).toBeInTheDocument();

    await goTo('/customers');
    const kabirLink = screen.getAllByRole('link', { name: /Kabir Nair/ }).find((link) => link.getAttribute('href') === '/customers/CUS-10480');
    await user.click(kabirLink);
    await user.click(screen.getByRole('button', { name: 'Approve KYC' }));
    expect(screen.getByText('Identity verification is verified.')).toBeInTheDocument();
  });

  it('shows customer holdings from ledger quantities with explicitly estimated demo valuation', () => {
    renderApp('/customers/CUS-10481');
    expect(screen.getByText('Estimated portfolio value · demo')).toBeInTheDocument();
    expect(screen.getByText(/1.360 g available · 0.640 g reserved/)).toBeInTheDocument();
    expect(screen.getByText(/estimated demo valuations at displayed sell rates/)).toBeInTheDocument();
  });

  it('validates, creates, edits, and confirms product status changes', async () => {
    const user = userEvent.setup();
    renderApp('/products');
    expect(screen.getByRole('row', { name: /Platinum/ })).toHaveTextContent('Platinum');
    await user.click(screen.getByRole('button', { name: 'Add product' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Save product' }).closest('form')).not.toBeValid();
    await user.type(within(dialog).getByLabelText('Product name'), '14K Demo Gold');
    await user.selectOptions(within(dialog).getByLabelText('Metal'), 'Gold');
    await user.type(within(dialog).getByLabelText('Purity (fineness)'), '585');
    await user.type(within(dialog).getByLabelText('Buy rate / gram (₹)'), '5000');
    await user.type(within(dialog).getByLabelText('Sell rate / gram (₹)'), '5100');
    await user.type(within(dialog).getByLabelText('Minimum order (₹)'), '10');
    await user.type(within(dialog).getByLabelText('Maximum order (₹)'), '100000');
    await user.click(within(dialog).getByRole('button', { name: 'Save product' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('sell rate lower than the buy rate');
    await user.clear(within(dialog).getByLabelText('Sell rate / gram (₹)'));
    await user.type(within(dialog).getByLabelText('Sell rate / gram (₹)'), '4500');
    await user.click(within(dialog).getByRole('button', { name: 'Save product' }));
    expect(await screen.findByText('14K Demo Gold')).toBeInTheDocument();

    const productRow = screen.getByRole('row', { name: /14K Demo Gold/ });
    await user.click(within(productRow).getByRole('button', { name: 'Edit 14K Demo Gold' }));
    const editDialog = screen.getByRole('dialog');
    await user.clear(within(editDialog).getByLabelText('Product name'));
    await user.type(within(editDialog).getByLabelText('Product name'), '14K Sample Gold');
    await user.click(within(editDialog).getByRole('button', { name: 'Save product' }));
    expect(await screen.findByRole('row', { name: /14K Sample Gold/ })).toBeInTheDocument();
    const renamedRow = screen.getByRole('row', { name: /14K Sample Gold/ });
    await user.click(within(renamedRow).getByRole('button', { name: 'Deactivate' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(renamedRow).toHaveTextContent('Active');
    await user.click(within(renamedRow).getByRole('button', { name: 'Deactivate' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Deactivate', exact: true }));
    expect(renamedRow).toHaveTextContent('Inactive');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter by status' }), 'Inactive');
    const inactiveRow = screen.getByRole('row', { name: /18K Digital Gold/ });
    await user.click(within(inactiveRow).getByRole('button', { name: 'Activate' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Activate', exact: true }));
    await waitFor(() => expect(screen.queryByRole('row', { name: /18K Digital Gold/ })).not.toBeInTheDocument());
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter by status' }), 'All statuses');
    expect(screen.getByRole('row', { name: /18K Digital Gold/ })).toHaveTextContent('Active');
  });

  it('creates and approves a rate request; supports confirmed rejection', async () => {
    const user = userEvent.setup();
    renderApp('/rates');
    const currentRates = screen.getByRole('heading', { name: 'Current sample rates and rules' }).closest('section');
    expect(within(currentRates).getByRole('row', { name: /Platinum/ })).toHaveTextContent('₹3,120');
    await user.click(screen.getByRole('button', { name: 'Request rate change' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Submit for approval' }).closest('form')).not.toBeValid();
    await user.selectOptions(within(dialog).getByLabelText('Metal product'), 'MET-001');
    await user.type(within(dialog).getByLabelText('Buy rate / gram (₹)'), '8000');
    await user.type(within(dialog).getByLabelText('Sell rate / gram (₹)'), '7800');
    await user.click(within(dialog).getByRole('button', { name: 'Submit for approval' }));
    const requestPanel = screen.getByRole('heading', { name: 'Rate change requests' }).closest('section');
    const rowsAfterCreate = await within(requestPanel).findAllByRole('row');
    expect(rowsAfterCreate).toHaveLength(7);
    const pendingRow = rowsAfterCreate[1];
    expect(pendingRow).toBeDefined();

    await user.click(within(pendingRow).getByRole('button', { name: /Approve RATE-2026-/ }));
    await goTo('/');
    expect(screen.getByText('₹8,000')).toBeInTheDocument();
    await goTo('/products');
    expect(screen.getByRole('row', { name: /24K Digital Gold/ })).toHaveTextContent('₹8,000');

    await goTo('/rates');
    await user.click(screen.getByRole('button', { name: 'Reject RATE-2026-015' }));
    await user.click(screen.getByRole('button', { name: 'Reject request' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter by request status' }), 'Rejected');
    expect(screen.getByRole('row', { name: /RATE-2026-015/ })).toHaveTextContent('Rejected');
  });
});

describe('operational workflows', () => {
  it('uses the Platinum product rate and its own configured fee policy in buy estimates', async () => {
    const user = userEvent.setup();
    renderApp('/products');
    const platinumRow = screen.getByRole('row', { name: /Platinum/ });
    await user.click(within(platinumRow).getByRole('button', { name: 'Edit Platinum' }));
    const editDialog = screen.getByRole('dialog');
    await user.clear(within(editDialog).getByLabelText('Buy charge (bps)'));
    await user.type(within(editDialog).getByLabelText('Buy charge (bps)'), '100');
    await user.clear(within(editDialog).getByLabelText('Buy tax on charge (bps)'));
    await user.type(within(editDialog).getByLabelText('Buy tax on charge (bps)'), '1800');
    await user.type(within(editDialog).getByLabelText('Minimum buy quantity'), '1.500');
    await user.type(within(editDialog).getByLabelText('Maximum buy quantity'), '2.000');
    await user.click(within(editDialog).getByRole('button', { name: 'Save product' }));

    await goTo('/orders');
    await user.selectOptions(screen.getByLabelText('Filter metal'), 'Platinum');
    expect(screen.getByRole('row', { name: /ORD-2026-08415/ })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Filter metal'), 'All metals');
    await user.click(screen.getByRole('button', { name: 'New buy' }));
    const orderDialog = screen.getByRole('dialog');
    await user.selectOptions(within(orderDialog).getByLabelText('Customer'), 'CUS-10482');
    await user.selectOptions(within(orderDialog).getByLabelText('Active metal product'), 'MET-005');
    await user.type(within(orderDialog).getByLabelText('Purchase amount (₹)'), '5000');
    const quote = within(orderDialog).getByRole('region', { name: 'Estimated order breakdown' });
    expect(quote).toHaveTextContent('Estimated quantity1.603 g');
    expect(quote).toHaveTextContent('Demo charges₹50');
    expect(quote).toHaveTextContent('Demo taxes₹9');
    expect(quote).toHaveTextContent('Estimated final payable₹5,059');
  });

  it('creates a simulated buy order and advances its status only after confirmation', async () => {
    const user = userEvent.setup();
    renderApp('/orders');
    await user.click(screen.getByRole('button', { name: 'New buy' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Create demo order' }).closest('form')).not.toBeValid();
    await user.selectOptions(within(dialog).getByLabelText('Customer'), 'CUS-10482');
    await user.selectOptions(within(dialog).getByLabelText('Active metal product'), 'MET-001');
    await user.type(within(dialog).getByLabelText('Purchase amount (₹)'), '100');
    await user.selectOptions(within(dialog).getByLabelText('Payment method'), 'UPI');
    await user.click(within(dialog).getByRole('button', { name: 'Create demo order' }));
    const createdOrderRow = (await screen.findAllByRole('row'))[1];
    const orderLink = within(createdOrderRow).getAllByRole('link')[0];
    await user.click(orderLink);
    expect(await screen.findByRole('heading', { name: 'Buy Gold' })).toBeInTheDocument();
    expect(screen.getByText('Pending', { selector: '.status-badge' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start processing' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Pending', { selector: '.status-badge' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start processing' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Start processing' }));
    expect(screen.getByText('Processing', { selector: '.status-badge' })).toBeInTheDocument();
  });

  it('creates a simulated sell order through the same validated order form', async () => {
    const user = userEvent.setup();
    renderApp('/orders');
    await user.click(screen.getByRole('button', { name: 'New sell' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Create simulated sell order');
    const form = screen.getByRole('dialog').querySelector('form');
    await user.selectOptions(within(form).getByLabelText('Customer'), 'CUS-10481');
    await user.selectOptions(within(form).getByLabelText('Active metal product'), 'MET-001');
    await user.type(within(form).getByLabelText('Quantity (grams)'), '2');
    expect(within(form).getByRole('alert')).toHaveTextContent('cannot exceed the available 1.360 g');
    await user.clear(within(form).getByLabelText('Quantity (grams)'));
    await user.type(within(form).getByLabelText('Quantity (grams)'), '1');
    await user.selectOptions(within(form).getByLabelText('Payment method'), 'Wallet');
    await user.click(within(form).getByRole('button', { name: 'Create demo order' }));
    expect(await screen.findAllByText(/Sell Gold/)).not.toHaveLength(0);
    expect(screen.getByText(/No payments, metal transfers/)).toBeInTheDocument();
  });

  it('previews quantity-based buy charges and records its calculated quantity', async () => {
    const user = userEvent.setup();
    renderApp('/orders');
    await user.click(screen.getByRole('button', { name: 'New buy' }));
    const form = screen.getByRole('dialog').querySelector('form');
    await user.selectOptions(within(form).getByLabelText('Customer'), 'CUS-10482');
    await user.selectOptions(within(form).getByLabelText('Active metal product'), 'MET-001');
    await user.selectOptions(within(form).getByLabelText('Purchase basis'), 'quantity');
    await user.type(within(form).getByLabelText('Quantity (grams)'), '1.250');
    expect(within(form).getByRole('region', { name: 'Estimated order breakdown' })).toHaveTextContent('Base purchase₹9,781.25');
    expect(within(form).getByRole('region', { name: 'Estimated order breakdown' })).toHaveTextContent('Demo charges₹0');
    await user.selectOptions(within(form).getByLabelText('Payment method'), 'UPI');
    await user.click(within(form).getByRole('button', { name: 'Create demo order' }));
    const createdRow = (await screen.findAllByRole('row'))[1];
    await user.click(within(createdRow).getAllByRole('link')[0]);
    expect(await screen.findByText('1.250 g')).toBeInTheDocument();
    expect(screen.getAllByText('₹9,781.25')).toHaveLength(2);
    expect(screen.getByText('Estimated final payable')).toBeInTheDocument();
  });

  it('creates a SIP and confirms pause/resume row actions', async () => {
    const user = userEvent.setup();
    renderApp('/sips');
    await user.click(screen.getByRole('button', { name: 'Create SIP' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Create demo SIP' }).closest('form')).not.toBeValid();
    await user.selectOptions(within(dialog).getByLabelText('Customer'), 'CUS-10481');
    await user.selectOptions(within(dialog).getByLabelText('Metal product'), 'MET-001');
    await user.type(within(dialog).getByLabelText('Installment amount (₹)'), '100');
    await user.clear(within(dialog).getByLabelText('Number of installments'));
    await user.type(within(dialog).getByLabelText('Number of installments'), '12');
    await user.click(within(dialog).getByRole('button', { name: 'Create demo SIP' }));
    expect(await screen.findByText('₹100')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Pause', exact: true })[0]);
    await user.click(screen.getByRole('button', { name: 'Pause plan' }));
    expect(screen.getByRole('combobox', { name: 'Filter SIP status' })).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter SIP status' }), 'Paused');
    expect(screen.getAllByText('Paused').length).toBeGreaterThan(0);
    const pausedRow = screen.getAllByRole('row').find((row) => row.textContent.includes('Pause') || row.textContent.includes('Resume'));
    await user.click(within(pausedRow).getByRole('button', { name: 'Resume' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Resume plan' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter SIP status' }), 'Active');
    const createdSipRow = screen.getAllByRole('row').find((row) => row.textContent.includes('SIP-2026-') && row.textContent.includes('₹100'));
    expect(createdSipRow).toBeDefined();
    await user.click(within(createdSipRow).getByRole('button', { name: 'Cancel' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel plan' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter SIP status' }), 'Cancelled');
    expect(screen.getAllByRole('row').some((row) => row.textContent.includes('₹100'))).toBe(true);
  });

  it('creates a coin redemption and supports confirmation and details actions', async () => {
    const user = userEvent.setup();
    renderApp('/redemptions');
    await user.click(screen.getByRole('button', { name: 'Create redemption' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Create demo request' }).closest('form')).not.toBeValid();
    await user.selectOptions(within(dialog).getByLabelText('Customer'), 'CUS-10481');
    await user.selectOptions(within(dialog).getByLabelText('Active metal'), 'MET-001');
    await user.type(within(dialog).getByLabelText('Quantity (grams)'), '2');
    expect(within(dialog).getByRole('alert')).toHaveTextContent('cannot exceed the available 1.360 g');
    await user.clear(within(dialog).getByLabelText('Quantity (grams)'));
    await user.type(within(dialog).getByLabelText('Quantity (grams)'), '1');
    await user.click(within(dialog).getByRole('button', { name: 'Create demo request' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('complete delivery address');
    await user.type(within(dialog).getByLabelText(/Delivery address/), '10 Demo Street, Pune, 411001');
    await user.click(within(dialog).getByRole('button', { name: 'Create demo request' }));
    const newRedemptionRow = (await screen.findAllByRole('row'))[1];
    const newRedemption = within(newRedemptionRow).getAllByRole('button')[0];
    const redemptionId = newRedemption.textContent;
    await user.click(newRedemption);
    expect(screen.getByRole('dialog')).toHaveTextContent('10 Demo Street, Pune, 411001');
    await user.click(screen.getByRole('button', { name: 'Close dialog' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter redemption status' }), 'Pending');
    const firstPendingRow = screen.getAllByRole('row').find((row) => row.textContent.includes('Pending'));
    await user.click(within(firstPendingRow).getByRole('button', { name: /Approve RDM-/ }));
    await user.click(screen.getByRole('button', { name: 'Approve request' }));
    expect(screen.getByRole('status')).toHaveTextContent('updated in demo state only');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter redemption status' }), 'Processing');
    const processingRow = screen.getAllByRole('row').find((row) => row.textContent.includes(redemptionId));
    await user.click(within(processingRow).getByRole('button', { name: /View RDM-/ }));
    await user.click(screen.getByRole('button', { name: 'Mark shipped' }));
    await user.click(within(screen.getAllByRole('dialog').at(-1)).getByRole('button', { name: 'Mark shipped' }));
    await user.click(screen.getByRole('button', { name: 'Mark delivered' }));
    await user.click(within(screen.getAllByRole('dialog').at(-1)).getByRole('button', { name: 'Mark delivered' }));
    await user.click(within(screen.getAllByRole('dialog').at(-1)).getByRole('button', { name: 'Close dialog' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter redemption status' }), 'Delivered');
    expect(screen.getAllByRole('row').some((row) => row.textContent.includes(redemptionId))).toBe(true);
  });

  it('creates and cancels a scheduled gift; resend remains simulated', async () => {
    const user = userEvent.setup();
    renderApp('/gifts');
    await user.click(screen.getByRole('button', { name: 'Create gift' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Create demo gift' }).closest('form')).not.toBeValid();
    await user.selectOptions(within(dialog).getByLabelText('Sender'), 'CUS-10482');
    await user.selectOptions(within(dialog).getByLabelText('Metal product'), 'MET-001');
    await user.type(within(dialog).getByLabelText('Recipient name'), 'Demo Recipient');
    await user.type(within(dialog).getByLabelText('Recipient email'), 'gift@example.com');
    await user.type(within(dialog).getByLabelText('Gift value (₹)'), '100');
    await user.clear(within(dialog).getByLabelText('Delivery date'));
    await user.type(within(dialog).getByLabelText('Delivery date'), '2026-10-20');
    await user.click(within(dialog).getByRole('button', { name: 'Create demo gift' }));
    const createdGift = await screen.findByText('Demo Recipient');
    expect(createdGift).toBeInTheDocument();
    const giftRow = createdGift.closest('tr');
    await user.click(within(giftRow).getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Cancel gift' }));
    expect(giftRow).toHaveTextContent('Cancelled');
    expect(screen.getByText(/No payment is taken and no message is sent/)).toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter gift status' }), 'Delivered');
    const deliveredRow = screen.getAllByRole('row').find((row) => row.textContent.includes('Delivered'));
    await user.click(within(deliveredRow).getByRole('button', { name: 'Resend' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Record resend' }));
    expect(deliveredRow).toHaveTextContent('Delivered');
  });

  it('keeps payments read-only while exposing payment details', async () => {
    const user = userEvent.setup();
    renderApp('/payments');
    expect(screen.queryByRole('button', { name: /Create|New payment/i })).not.toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: /PAY-2026-/ })[0]);
    expect(screen.getByRole('dialog')).toHaveTextContent('Read-only demo record');
    expect(screen.getByRole('dialog')).not.toHaveTextContent('Refund');
  });

  it('records refund decisions only after confirmation and settlement review as annotation', async () => {
    const user = userEvent.setup();
    renderApp('/refunds');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter refund status' }), 'Pending review');
    const pendingRow = screen.getAllByRole('row').find((row) => row.textContent.includes('Pending review'));
    await user.click(within(pendingRow).getByRole('button', { name: 'Approve request' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(pendingRow).toHaveTextContent('Pending review');
    await user.click(within(pendingRow).getByRole('button', { name: 'Approve request' }));
    await user.click(screen.getByRole('button', { name: 'Approved request' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter refund status' }), 'Approved');
    expect(screen.getAllByText('Approved').length).toBeGreaterThan(0);
    expect(screen.getByText(/never sends, schedules, or simulates a real refund/)).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter refund status' }), 'Pending review');
    const nextPendingRefund = screen.getAllByRole('row').find((row) => row.textContent.includes('Pending review'));
    await user.click(within(nextPendingRefund).getByRole('button', { name: 'Reject' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Rejected request' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter refund status' }), 'Rejected');
    expect(screen.getAllByRole('row').some((row) => row.textContent.includes('Rejected'))).toBe(true);

    await goTo('/reconciliation');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter settlement status' }), 'Mismatch');
    const mismatchRow = screen.getAllByRole('row').find((row) => row.textContent.includes('Mismatch'));
    await user.click(within(mismatchRow).getByRole('button', { name: /Mark reviewed/ }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mismatchRow).toHaveTextContent('Mismatch');
    await user.click(within(mismatchRow).getByRole('button', { name: /Mark reviewed/ }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Mark reviewed' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter settlement status' }), 'Reviewed');
    expect(screen.getAllByText('Reviewed').length).toBeGreaterThan(0);
  });
});

describe('administration demo behavior and reports', () => {
  it('saves settings for the mounted session, logs changes, and resets after remount', async () => {
    const user = userEvent.setup();
    const view = renderApp('/settings');
    await user.clear(screen.getByLabelText('Organization name'));
    await user.type(screen.getByLabelText('Organization name'), 'Test Demo Org');
    await user.clear(screen.getByLabelText('Support email'));
    await user.type(screen.getByLabelText('Support email'), 'TEAM@EXAMPLE.COM');
    await user.click(screen.getAllByRole('button', { name: 'Save settings' })[0]);
    expect(screen.getByRole('status')).toHaveTextContent('browser session only');
    await goTo('/audit-logs');
    await user.type(screen.getByRole('textbox', { name: 'Search audit events' }), 'Updated platform settings');
    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(screen.getAllByRole('row')[1]).toHaveTextContent('Updated platform settings');
    await goTo('/settings');
    expect(screen.getByLabelText('Organization name')).toHaveValue('Test Demo Org');
    await user.click(screen.getByRole('button', { name: 'Turn on demo banner' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm demo change' }));
    expect(screen.getByRole('status')).toHaveTextContent('No service availability changed');
    await user.click(screen.getByRole('button', { name: 'Reset to demo defaults' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Reset settings' }));
    expect(screen.getByLabelText('Organization name')).toHaveValue('Digital Gold Platform');
    view.unmount();
    renderApp('/settings');
    expect(screen.getByLabelText('Organization name')).not.toHaveValue('Test Demo Org');
  });

  it('limits roles to Super Admin and Admin and lets only Super Admin configure Admin permissions', async () => {
    const user = userEvent.setup();
    renderApp('/roles');
    expect(screen.getByText('Configured roles').parentElement).toHaveTextContent('2');
    const availableRoles = screen.getByRole('region', { name: 'Available roles' });
    const roleButtons = [...availableRoles.querySelectorAll('.role-list-item')];
    expect(roleButtons.map((button) => button.querySelector('strong').textContent)).toEqual(['Super Admin', 'Admin']);

    await user.click(roleButtons[0]);
    const protectedSwitch = screen.getByRole('switch', { name: /Customers access enabled.*always enabled/ });
    expect(protectedSwitch).toBeDisabled();
    await user.click(roleButtons[1]);
    const switchControl = screen.getByRole('switch', { name: 'Reports & exports access disabled' });
    expect(switchControl).toBeEnabled();
    await user.click(switchControl);
    expect(switchControl).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('switch', { name: 'Reports & exports access disabled' })).toBeInTheDocument();

    await user.click(screen.getByRole('switch', { name: 'Products & rates access disabled' }));
    await user.click(screen.getByRole('button', { name: 'Save permissions' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('frontend demo session');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save permissions' }));
    expect(screen.getByRole('switch', { name: 'Products & rates access enabled' })).toBeInTheDocument();

    await user.click(document.querySelector('.profile-button'));
    await user.click(screen.getByRole('button', { name: 'Preview as Admin' }));
    expect(screen.getByText(/does not have permission to access this page/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Roles & permissions' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Preview as Admin' })).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Access denied');
    expect(screen.queryByRole('button', { name: /Super Admin/ })).not.toBeInTheDocument();
  });

  it('switches report datasets and filters statuses and invalid date ranges', async () => {
    const user = userEvent.setup();
    renderApp('/reports');
    await user.click(screen.getByRole('tab', { name: 'Refunds' }));
    expect(screen.getAllByRole('row')).toHaveLength(6);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter report status' }), 'Pending review');
    expect(screen.getAllByRole('row')).toHaveLength(3);
    await user.click(screen.getByRole('tab', { name: 'Settlements' }));
    expect(screen.getByRole('combobox', { name: 'Filter report status' })).toHaveValue('All statuses');
    await user.type(screen.getByLabelText('From'), '2026-10-15');
    await user.type(screen.getByLabelText('To'), '2026-10-14');
    expect(screen.getByRole('alert')).toHaveTextContent('Start date must be on or before end date.');
    expect(screen.getByRole('button', { name: 'Export filtered CSV' })).toBeDisabled();
  });

  it('exports only filtered report rows through a browser download link and audits the export', async () => {
    const user = userEvent.setup();
    let exportedBlob;
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn((blob) => {
        exportedBlob = blob;
        return 'blob:report-test';
      }),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function clickAnchor() {
      expect(this.download).toBe('digital-gold-refunds-report.csv');
      expect(this.href).toBe('blob:report-test');
    });
    renderApp('/reports');
    await user.click(screen.getByRole('tab', { name: 'Refunds' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter report status' }), 'Pending review');
    await user.click(screen.getByRole('button', { name: 'Export filtered CSV' }));
    const csv = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(new TextDecoder('utf-8', { ignoreBOM: true }).decode(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(exportedBlob);
    });
    expect(csv).toContain('"Record ID","Reference","Customer / provider"');
    expect(csv).toContain('REF-2026-00318');
    expect(csv).toContain('REF-2026-00314');
    expect(csv).not.toContain('REF-2026-00317');
    await goTo('/audit-logs');
    await user.type(screen.getByRole('textbox', { name: 'Search audit events' }), 'digital-gold-refunds-report.csv');
    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(screen.getAllByRole('row')[1]).toHaveTextContent('digital-gold-refunds-report.csv');
  });
});
