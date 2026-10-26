import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Activity, ArrowDownLeft, ArrowUpRight, BadgeCheck, CalendarDays, Clock3, Download, Gem, RefreshCw, ShieldAlert, WalletCards } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import DataTable from '../components/DataTable.jsx';
import PageHeader from '../components/PageHeader.jsx';
import StatCard from '../components/StatCard.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { dashboardStats, metalRates } from '../data/dashboardData.js';
import useDocumentTitle from '../hooks/useDocumentTitle.js';
import { formatCurrency, isValidCurrencyAmount } from '../utils/formatters.js';
import { useManagement } from '../context/ManagementContext.jsx';
import { useOperations } from '../context/OperationsContext.jsx';
import { deriveDashboardMetrics, mockOrderDateKey } from '../utils/financial.js';
import { useAdmin } from '../context/AdminContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function DashboardPage() {
  useDocumentTitle('Overview');
  const periods = ['7 days', '30 days', '90 days'];
  const [period, setPeriod] = useState('30 days');
  const { customers, products, rateRequests } = useManagement();
  const { orders, payments, sips, redemptions } = useOperations();
  const { activeRole, hasPermission, auditEvents } = useAdmin();
  const { user } = useAuth();
  const { dashboardSearch = '' } = useOutletContext() ?? {};
  const asOfDate = new Date().toISOString().slice(0, 10);
  const metrics = deriveDashboardMetrics({ customers, orders, payments, sips, redemptions }, asOfDate);
  const incompleteMetalProducts = products.filter((item) => (
    typeof item?.metal !== 'string' || !item.metal.trim()
    || typeof item.purity !== 'string' || !item.purity.trim()
  ));
  const productsMissingRates = products.filter((item) => (
    typeof item?.metal === 'string'
    && item.metal.trim()
    && item.status === 'Active'
    && (!isValidCurrencyAmount(item.buyRate) || !isValidCurrencyAmount(item.sellRate))
  ));
  const displayedRates = metalRates.map((metal) => {
    const product = products.find((item) => typeof item?.metal === 'string'
      && item.metal.trim().toLowerCase() === metal.key
      && item.status === 'Active'
      && (metal.key !== 'gold' || (typeof item.purity === 'string' && item.purity.includes('999'))));
    return product ? {
      ...metal,
      purity: `${product.purity} purity`,
      buy: isValidCurrencyAmount(product.buyRate) ? product.buyRate : null,
      sell: isValidCurrencyAmount(product.sellRate) ? product.sellRate : null,
    } : { ...metal, purity: 'No active product', buy: null, sell: null };
  });
  const statPermissions = {
    'Registered customers': 'customers',
    'Verified customers': 'customers',
    'Buy / sell volume': 'orders',
    'Gross transaction value': 'orders',
    'Pending payments': 'finance',
    'Failed orders': 'orders',
    'Pending redemptions': 'fulfillment',
    'Active SIPs': 'orders',
  };
  const stats = dashboardStats.filter((stat) => hasPermission(statPermissions[stat.label])).map((stat) => {
    const values = {
      'Registered customers': [String(metrics.registeredCustomers), 'All customer profiles'],
      'Verified customers': [String(metrics.verifiedCustomers), 'Verified profiles'],
      'Buy / sell volume': [formatCurrency(metrics.completedAmountPaise / 100), 'Completed orders · last 30 days'],
      'Gross transaction value': [String(metrics.completedOrderCount), 'Unique completed orders · last 30 days'],
      'Pending payments': [String(metrics.pendingPayments), 'Pending or processing payment records'],
      'Failed orders': [String(metrics.failedOrders), 'Failed orders · last 30 days'],
      'Pending redemptions': [String(metrics.pendingRedemptions), 'Awaiting review'],
      'Active SIPs': [String(metrics.activeSips), 'Active plans'],
    };
    return { ...stat, label: stat.label === 'Gross transaction value' ? 'Completed transactions' : stat.label, value: values[stat.label][0], detail: values[stat.label][1], change: '', trend: 'up' };
  });
  const filteredTransactions = useMemo(() => {
    const query = dashboardSearch.trim().toLowerCase();
    return orders.map((order) => ({
      id: order.id,
      customer: order.customer,
      initials: order.customer.split(' ').map((part) => part[0]).join('').slice(0, 2),
      email: customers.find((customer) => customer.id === order.customerId)?.email ?? '—',
      date: order.placedAt,
      type: order.type,
      metal: order.metal,
      amount: order.amount,
      status: order.status,
    })).filter((transaction) =>
      [transaction.id, transaction.customer, transaction.email, transaction.type, transaction.metal, transaction.status]
        .some((value) => value.toLowerCase().includes(query)),
    ).slice(0, 5);
  }, [dashboardSearch, orders, customers]);
  const attentionItems = [
    { permission: 'customers', label: 'Customer verifications', detail: 'Identity checks awaiting review', count: customers.filter((item) => item.kycStatus === 'Pending').length, icon: <BadgeCheck size={17} />, tone: 'amber' },
    { permission: 'products', label: 'Rate change approval', detail: 'Rate requests awaiting review', count: rateRequests.filter((item) => item.status === 'Pending').length, icon: <RefreshCw size={17} />, tone: 'violet' },
    { permission: 'finance', label: 'Payment exceptions', detail: 'Pending or failed payments', count: payments.filter((item) => ['Pending', 'Processing', 'Failed'].includes(item.status)).length, icon: <WalletCards size={17} />, tone: 'blue' },
    { permission: 'fulfillment', label: 'Redemption requests', detail: 'Pending fulfilment review', count: redemptions.filter((item) => item.status === 'Pending').length, icon: <ShieldAlert size={17} />, tone: 'red' },
  ].filter((item) => hasPermission(item.permission));
  const visibleActivityItems = auditEvents.filter((item) => hasPermission(item.category === 'Customers' ? 'customers' : item.category === 'Products' || item.category === 'Rates' ? 'products' : item.category === 'Payments' || item.category === 'Refunds' ? 'finance' : item.category === 'Redemptions' || item.category === 'Gifts' ? 'fulfillment' : item.category === 'Administration' || item.category === 'Settings' ? 'administration' : 'audit')).slice(0, 6).map((item) => ({
    ...item,
    initials: item.actor.split(' ').map((part) => part[0]).join('').slice(0, 2),
    time: new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.timestamp)),
    tone: 'teal',
  }));
  const chartData = useMemo(() => {
    const dayCount = Number.parseInt(period, 10);
    const bucketCount = period === '7 days' ? 7 : period === '30 days' ? 6 : 13;
    const today = new Date(`${asOfDate}T00:00:00.000Z`);
    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() - dayCount + 1);
    const bucketSize = (dayCount * 24 * 60 * 60 * 1000) / bucketCount;
    const buckets = Array.from({ length: bucketCount }, (_, index) => {
      const date = new Date(start.getTime() + index * bucketSize);
      return { date: new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(date), buy: 0, sell: 0 };
    });
    for (const order of orders) {
      const orderDateKey = mockOrderDateKey(order.placedAt);
      if (!orderDateKey) continue;
      const orderDate = new Date(`${orderDateKey}T00:00:00.000Z`);
      const offset = orderDate.getTime() - start.getTime();
      if (offset < 0 || orderDate > today) continue;
      const index = Math.min(bucketCount - 1, Math.floor(offset / bucketSize));
      if (order.status === 'Completed') buckets[index][order.type.toLowerCase()] += Number(order.amount) / 100000;
    }
    return buckets;
  }, [period, orders, asOfDate]);
  const columns = [
    { key: 'id', label: 'Transaction', render: (value, row) => <div className="transaction-id-cell"><span className={`transaction-type-icon ${row.type.toLowerCase()}`}>{row.type === 'Buy' ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}</span><div><strong>{value}</strong><small>{row.date}</small></div></div> },
    { key: 'customer', label: 'Customer', render: (value, row) => <div className="customer-cell"><span className="customer-avatar">{row.initials}</span><div><strong>{value}</strong><small>{row.email}</small></div></div> },
    { key: 'type', label: 'Order type', render: (value, row) => <span className={`order-type type-${value.toLowerCase()}`}>{value} {row.metal}</span> },
    { key: 'amount', label: 'Amount', align: 'right', render: (value) => <strong>{formatCurrency(value)}</strong> },
    { key: 'status', label: 'Status', render: (value) => <StatusBadge status={value} /> },
  ];

  return (
    <>
      <PageHeader
        eyebrow={new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date())}
        title={`Good morning, ${activeRole?.name ?? user?.name ?? 'Admin'}`}
        description="Here’s what’s happening across your platform today."
        actions={<button className="button button-secondary dashboard-export" onClick={() => window.print()}><Download size={16} /> Export overview</button>}
      />


      {stats.length > 0 && <section className="stat-grid" aria-label="Platform metrics">
        {stats.map((stat) => <StatCard key={stat.label} {...stat} icon={stat.icon} />)}
      </section>}

      {hasPermission('products') && <section className="rates-section" aria-label="Indicative metal rates">
        <div className="section-heading-row rate-heading">
          <div><h2>Indicative metal rates</h2><p>Configured buy and sell rates per gram</p></div>
          <div className="rate-updated"><RefreshCw size={13} /> Updated 2 min ago</div>
        </div>
        {incompleteMetalProducts.length > 0 && (
          <p role="alert">
            {incompleteMetalProducts.length} product {incompleteMetalProducts.length === 1 ? 'record is' : 'records are'} missing a metal type or purity. Check the product data; affected records are excluded from these rates.
          </p>
        )}
        {productsMissingRates.length > 0 && (
          <p role="alert">
            {productsMissingRates.length} active product {productsMissingRates.length === 1 ? 'record has' : 'records have'} missing or invalid buy/sell rates. Check the saved product data; unavailable values are not displayed as prices.
          </p>
        )}
        <div className="rate-grid">
          {displayedRates.map((metal) => (
            <article className={`rate-card rate-${metal.key}`} key={metal.key}>
              <div className="rate-card-top"><span className={`metal-icon ${metal.key}`}><Gem size={19} /></span><span className="rate-label">{metal.name}</span><span className="rate-purity">{metal.purity}</span></div>
              <div className="rate-values"><div><span>BUY / g</span><strong>{metal.buy === null ? '—' : formatCurrency(metal.buy)}</strong></div><div><span>SELL / g</span><strong>{metal.sell === null ? '—' : formatCurrency(metal.sell)}</strong></div>{metal.change !== 'Sample rate' && <span className="rate-change"><ArrowUpRight size={14} /> {metal.change}</span>}</div>
              <div className="rate-card-footer"><span><span className="live-dot" /> {metal.buy === null && metal.sell === null ? (metal.purity === 'No active product' ? 'No active product' : 'Rate unavailable') : 'Sample indicative rate'}</span><span>{metal.updated}</span></div>
            </article>
          ))}
        </div>
      </section>}

      <div className="dashboard-main-grid">
        {hasPermission('orders') && <section className="panel volume-panel">
          <div className="panel-heading">
            <div><h2>Transaction volume</h2><p>Completed buy and sell order value from stored records</p></div>
            <div className="period-control" aria-label="Chart time period">{periods.map((item) => <button className={period === item ? 'selected' : ''} key={item} onClick={() => setPeriod(item)}>{item}</button>)}</div>
          </div>
          <div className="chart-legend"><span><i className="legend-dot buy-dot" /> Buy volume</span><span><i className="legend-dot sell-dot" /> Sell volume</span></div>
          <div className="volume-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 5, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="buyFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#14b8a6" stopOpacity={0.19} /><stop offset="95%" stopColor="#14b8a6" stopOpacity={0} /></linearGradient>
                  <linearGradient id="sellFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#818cf8" stopOpacity={0.14} /><stop offset="95%" stopColor="#818cf8" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid stroke="#eef1f6" vertical={false} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#98a2b3', fontSize: 11 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#98a2b3', fontSize: 11 }} tickFormatter={(value) => `${value}L`} width={36} />
                <Tooltip contentStyle={{ border: '1px solid #edf0f5', borderRadius: 10, boxShadow: '0 8px 24px rgba(16, 27, 51, .10)', fontSize: 12 }} formatter={(value, name) => [`₹${value}L`, name === 'buy' ? 'Buy volume' : 'Sell volume']} />
                <Area type="monotone" dataKey="buy" stroke="#14b8a6" strokeWidth={2.4} fill="url(#buyFill)" activeDot={{ r: 4, strokeWidth: 0 }} />
                <Area type="monotone" dataKey="sell" stroke="#818cf8" strokeWidth={2.2} fill="url(#sellFill)" activeDot={{ r: 4, strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="volume-summary"><div><span>Completed buy value</span><strong>{formatCurrency(metrics.completedBuyAmountPaise / 100)}</strong><small>30-day sample · completed orders only</small></div><div><span>Completed sell value</span><strong>{formatCurrency(metrics.completedSellAmountPaise / 100)}</strong><small>30-day sample · failed orders excluded</small></div><div><span>Completed transaction value</span><strong>{formatCurrency(metrics.completedAmountPaise / 100)}</strong><small>{metrics.completedOrderCount} unique completed orders · payments are not double-counted</small></div></div>
        </section>}

        {attentionItems.length > 0 && <section className="panel approvals-panel">
          <div className="panel-heading"><div><h2>Needs attention</h2><p>Items waiting for your review</p></div><button className="icon-button subtle-icon" aria-label="Attention queue activity"><Activity size={18} /></button></div>
          <div className="approval-list">
            {attentionItems.map((item) => <div className="approval-item" key={item.permission}><span className={`approval-icon approval-${item.tone}`}>{item.icon}</span><div className="approval-copy"><strong>{item.label}</strong><span>{item.detail}</span></div><span className={`approval-count ${item.tone}-count`}>{item.count}</span></div>)}
          </div>
          <div className="attention-footnote"><Clock3 size={14} /> Counts reflect current stored records.</div>
        </section>}
      </div>

      <div className="dashboard-bottom-grid">
        {hasPermission('orders') && <section className="panel transactions-panel">
          <div className="panel-heading"><div><h2>Recent transactions</h2><p>Latest stored orders</p></div><span className="table-count-label">LATEST 5</span></div>
          <DataTable columns={columns} rows={filteredTransactions} />
          <div className="table-footnote"><span>{dashboardSearch.trim() ? `${filteredTransactions.length} matching transactions` : 'Showing recent transactions'}</span><span>As of {asOfDate}</span></div>
        </section>}
        {visibleActivityItems.length > 0 && <section className="panel activity-panel">
          <div className="panel-heading"><div><h2>Recent activity</h2><p>Latest admin and platform events</p></div><button className="icon-button subtle-icon" aria-label="More activity options"><CalendarDays size={17} /></button></div>
          <div className="activity-list">
            {visibleActivityItems.map((item) => (
              <div className="activity-item" key={item.id}>
                <span className={`activity-avatar activity-${item.tone}`}>{item.initials}</span>
                <div className="activity-copy"><p><strong>{item.actor}</strong> {item.action} <b>{item.target}</b></p><span>{item.time}</span></div>
              </div>
            ))}
          </div>
          <div className="activity-footnote"><span className="activity-footnote-dot" /> Activity feed from persisted audit events</div>
        </section>}
      </div>
      <footer className="dashboard-footer"><span>Digital Gold Platform Admin</span><span>Financial actions require external payment and custody integrations.</span></footer>
    </>
  );
}
