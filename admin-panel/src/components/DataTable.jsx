import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

function compareValues(left, right) {
  if (left == null && right == null) return 0;
  if (left == null) return -1;
  if (right == null) return 1;
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  const dateLike = (value) => typeof value === 'string' && (/^\d{4}-\d{2}-\d{2}/.test(value) || /\b\d{1,2} [A-Za-z]{3} \d{4}\b/.test(value));
  const leftTime = dateLike(left) ? Date.parse(left) : Number.NaN;
  const rightTime = dateLike(right) ? Date.parse(right) : Number.NaN;
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) return leftTime - rightTime;
  return new Intl.Collator('en', { numeric: true, sensitivity: 'base' }).compare(String(left), String(right));
}

export default function DataTable({ columns, rows, allRows, page, pageSize, onPageChange, rowKey = 'id' }) {
  const [sort, setSort] = useState({ key: '', direction: 'asc' });
  const sourceRows = allRows ?? rows;
  const sortedRows = useMemo(() => {
    if (!sort.key) return sourceRows;
    const column = columns.find((item) => item.key === sort.key);
    if (!column) return sourceRows;
    return [...sourceRows].sort((left, right) => {
      const leftValue = column.sortValue ? column.sortValue(left) : left[column.key];
      const rightValue = column.sortValue ? column.sortValue(right) : right[column.key];
      const comparison = compareValues(leftValue, rightValue);
      return sort.direction === 'asc' ? comparison : -comparison;
    });
  }, [sourceRows, columns, sort]);
  const visibleRows = allRows && Number.isInteger(page) && Number.isInteger(pageSize)
    ? sortedRows.slice((page - 1) * pageSize, page * pageSize)
    : sortedRows;

  function handleSort(key) {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
    onPageChange?.(1);
  }

  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>{columns.map((column) => {
            const sortable = column.sortable !== false && Boolean(column.label);
            return (
            <th key={column.key} className={column.align === 'right' ? 'align-right' : ''} aria-sort={sort.key === column.key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}>
              {sortable ? (
                <button className="table-sort" onClick={() => handleSort(column.key)} aria-label={`Sort by ${column.label}`}>
                  {column.label}
                  {sort.key === column.key
                    ? (sort.direction === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />)
                    : <ArrowUpDown size={13} />}
                </button>
              ) : column.label}
            </th>
          );})}</tr>
        </thead>
        <tbody>
          {visibleRows.map((row) => (
            <tr key={row[rowKey]}>
              {columns.map((column) => (
                <td key={column.key} className={column.align === 'right' ? 'align-right' : ''}>
                  {column.render ? column.render(row[column.key], row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
          {visibleRows.length === 0 && <tr><td className="empty-table" colSpan={columns.length}>No records to display.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
