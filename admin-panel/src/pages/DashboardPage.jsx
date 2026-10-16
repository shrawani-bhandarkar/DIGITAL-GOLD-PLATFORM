import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Activity, ArrowDownLeft, ArrowUpRight, BadgeCheck, CalendarDays, Clock3, Download, Gem, RefreshCw, ShieldAlert, WalletCards } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import DataTable from '../components/DataTable.jsx';
import PageHeader from '../components/PageHeader.jsx';
import StatCard from '../components/StatCard.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { activityItems, dashboardStats, metalRates, monthlyVolume } from '../data/dashboardData.js';
import useDocumentTitle from '../hooks/useDocumentTitle.js';
import { formatCurrency } from '../utils/formatters.js';
import { useManagement } from '../context/ManagementContext.jsx';
import { useOperations } from '../context/OperationsContext.jsx';
import { deriveDashboardMetrics } from '../utils/financial.js';

export default function DashboardPage() {
  useDocumentTitle('Overview');
  const periods = ['7 days', '30 days', '90 days'];
  const [period, setPeriod] = useState('30 days');
  const { customers, products } = useManagement();
  const { orders, payments, sips, redemptions } = useOperations();
  const { dashboardSearch = '' } = useOutletContext() ?? {};
  const metrics = deriveDashboardMetrics({ customers, orders, payments, sips, redemptions });
  const displayedRates = metalRates.map((metal) => {
    const product = products.find((item) => item.metal.toLowerCase() === metal.key && item.status === 'Active'
      && (metal.key !== 'gold' || item.purity.includes('999.9')));
    return product ? { ...metal, purity: `${product.purity} purity`, buy: product.buyRate, sell: product.sellRate } : { ...metal, purity: 'No active product', buy: null, sell: null };
  });
  const stats = dashboardStats.map((stat) => {
    const values = {
      'Registered customers': [String(metrics.registeredCustomers), 'All sample customer profiles'],
      'Verified customers': [String(metrics.verifiedCustomers), 'Verified sample profiles'],
      'Buy / sell volume': [formatCurrency(metrics.completedAmountPaise / 100), 'Completed orders · 30-day sample'],
      'Gross transaction value': [String(metrics.completedOrderCount), 'Unique completed orders · 30-day sample'],
      'Pending payments': [String(metrics.pendingPayments), 'Pending or processing payment records'],
      'Failed orders': [String(metrics.failedOrders), 'Failed orders · 30-day sample'],
      'Pending redemptions': [String(metrics.pendingRedemptions), 'Awaiting review in demo state'],
      'Active SIPs': [String(metrics.activeSips), 'Active sample plans · no debits scheduled'],
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
  const chartData = useMemo(() => {
    if (period === '7 days') return monthlyVolume.slice(-4);
    if (period === '90 days') {
      const extraDates = ['19 Jul', '27 Jul', '04 Aug', '12 Aug', '20 Aug', '28 Aug', '05 Sep'];
      return [
        ...monthlyVolume.slice(4).map((point, index) => ({ ...point, date: extraDates[index] ?? point.date })),
        ...monthlyVolume.slice(0, 4),
      ];
    }
    return monthlyVolume;
  }, [period]);
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
        eyebrow="THURSDAY, 15 OCTOBER 2026"
        title="Good morning, Admin"
        description="Here’s what’s happening across your platform today."
        actions={<button className="button button-secondary dashboard-export" onClick={() => window.print()}><Download size={16} /> Export overview</button>}
      />

      <div className="demo-data-banner"><span className="demo-data-pulse" /><strong>DEMO DATA</strong><span>All rates, customer figures, and financial amounts on this dashboard are sample values for preview only.</span></div>

      <section className="stat-grid" aria-label="Platform metrics">
        {stats.map((stat) => <StatCard key={stat.label} {...stat} icon={stat.icon} />)}
      </section>

      <section className="rates-section" aria-label="Indicative metal rates">
        <div className="section-heading-row rate-heading">
          <div><h2>Indicative metal rates</h2><p>Sample rates per gram · DEMO DATA</p></div>
          <div className="rate-updated"><RefreshCw size={13} /> Updated 2 min ago</div>
        </div>
        <div className="rate-grid">
          {displayedRates.map((metal) => (
            <article className={`rate-card rate-${metal.key}`} key={metal.key}>
              <div className="rate-card-top"><span className={`metal-icon ${metal.key}`}><Gem size={19} /></span><span className="rate-label">{metal.name}</span><span className="rate-purity">{metal.purity}</span></div>
              <div className="rate-values"><div><span>BUY / g</span><strong>{metal.buy === null ? '—' : formatCurrency(metal.buy)}</strong></div><div><span>SELL / g</span><strong>{metal.sell === null ? '—' : formatCurrency(metal.sell)}</strong></div>{metal.change !== 'Sample rate' && <span className="rate-change"><ArrowUpRight size={14} /> {metal.change}</span>}</div>
              <div className="rate-card-footer"><span><span className="live-dot" /> {metal.buy === null ? 'No active product' : 'Sample indicative rate'}</span><span>{metal.updated}</span></div>
            </article>
          ))}
        </div>
      </section>

      <div className="dashboard-main-grid">
        <section className="panel volume-panel">
          <div className="panel-heading">
            <div><h2>Transaction volume</h2><p>Buy &amp; sell value over time · DEMO DATA</p></div>
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
        </section>

        <section className="panel approvals-panel">
          <div className="panel-heading"><div><h2>Needs attention</h2><p>Items waiting for your review</p></div><button className="icon-button subtle-icon" aria-label="Attention queue activity"><Activity size={18} /></button></div>
          <div className="approval-list">
            <div className="approval-item"><span className="approval-icon approval-amber"><BadgeCheck size={17} /></span><div className="approval-copy"><strong>Customer verifications</strong><span>Identity checks awaiting review</span></div><span className="approval-count amber-count">12</span></div>
            <div className="approval-item"><span className="approval-icon approval-violet"><RefreshCw size={17} /></span><div className="approval-copy"><strong>Rate change approval</strong><span>Maker-checker review required</span></div><span className="approval-count violet-count">2</span></div>
            <div className="approval-item"><span className="approval-icon approval-blue"><WalletCards size={17} /></span><div className="approval-copy"><strong>Payment exceptions</strong><span>Transactions needing investigation</span></div><span className="approval-count blue-count">4</span></div>
            <div className="approval-item"><span className="approval-icon approval-red"><ShieldAlert size={17} /></span><div className="approval-copy"><strong>Redemption requests</strong><span>Pending fulfilment review</span></div><span className="approval-count red-count">3</span></div>
          </div>
          <div className="attention-footnote"><Clock3 size={14} /> Queue counts are simulated demo values.</div>
        </section>
      </div>

      <div className="dashboard-bottom-grid">
        <section className="panel transactions-panel">
          <div className="panel-heading"><div><h2>Recent transactions</h2><p>Latest activity across your platform · DEMO DATA</p></div><span className="table-count-label">LATEST 5</span></div>
          <DataTable columns={columns} rows={filteredTransactions} />
          <div className="table-footnote"><span>{dashboardSearch.trim() ? `${filteredTransactions.length} matching sample transactions` : 'Showing recent sample transactions'}</span><span>As of 15 Oct 2026</span></div>
        </section>
        <section className="panel activity-panel">
          <div className="panel-heading"><div><h2>Recent activity</h2><p>Latest admin and platform events</p></div><button className="icon-button subtle-icon" aria-label="More activity options"><CalendarDays size={17} /></button></div>
          <div className="activity-list">
            {activityItems.map((item) => (
              <div className="activity-item" key={item.id}>
                <span className={`activity-avatar activity-${item.tone}`}>{item.initials}</span>
                <div className="activity-copy"><p><strong>{item.actor}</strong> {item.action} <b>{item.target}</b></p><span>{item.time}</span></div>
              </div>
            ))}
          </div>
          <div className="activity-footnote"><span className="activity-footnote-dot" /> Activity feed contains demo events</div>
        </section>
      </div>
      <footer className="dashboard-footer"><span>Digital Gold Platform Admin</span><span>Dashboard is in demo mode · No live financial operations</span></footer>
    </>
  );
}
