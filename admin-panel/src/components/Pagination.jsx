import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ page, pageSize, total, onPageChange }) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return (
    <div className="pagination">
      <span>Showing <strong>{start}–{end}</strong> of <strong>{total}</strong></span>
      <div>
        <button className="button button-secondary" onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Previous page"><ChevronLeft size={15} /> Previous</button>
        <span className="pagination-page">Page {page} of {pageCount}</span>
        <button className="button button-secondary" onClick={() => onPageChange(page + 1)} disabled={page >= pageCount} aria-label="Next page">Next <ChevronRight size={15} /></button>
      </div>
    </div>
  );
}
