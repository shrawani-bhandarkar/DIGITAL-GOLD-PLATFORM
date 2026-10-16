import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

export default function StatCard({ label, value, change, trend = 'up', changeTone, icon: Icon, tone = 'teal', detail }) {
  const isUp = trend === 'up';
  const isPositive = changeTone ? changeTone === 'positive' : isUp;
  return (
    <article className="stat-card">
      <div className="stat-card-top">
        <span>{label}</span>
        <span className={`stat-icon stat-icon-${tone}`}><Icon size={18} strokeWidth={2} /></span>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-card-bottom">
        {change && <span className={`stat-change ${isPositive ? 'positive' : 'negative'}`}>
          {isUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{change}
        </span>}
        <span className="stat-detail">{detail}</span>
      </div>
    </article>
  );
}
