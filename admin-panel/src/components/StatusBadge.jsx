const STATUS_CLASS = {
  Completed: 'success',
  Successful: 'success',
  Verified: 'success',
  Approved: 'success',
  Pending: 'warning',
  Processing: 'info',
  Failed: 'danger',
  Rejected: 'danger',
  Inactive: 'neutral',
  Suspended: 'danger',
  Shipped: 'info',
  Delivered: 'success',
  Redeemed: 'success',
  Active: 'success',
  Cancelled: 'neutral',
  Expired: 'neutral',
  Scheduled: 'info',
  'Pending review': 'warning',
  Matched: 'success',
  Mismatch: 'danger',
  Reviewed: 'info',
  'Partially matched': 'warning',
};

export default function StatusBadge({ status }) {
  const className = STATUS_CLASS[status] ?? 'neutral';
  return <span className={`status-badge status-${className}`}><span />{status}</span>;
}
