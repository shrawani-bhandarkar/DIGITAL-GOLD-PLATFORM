import { Check } from 'lucide-react';

export default function StatusTimeline({ items = [] }) {
  return (
    <ol className="status-timeline">
      {items.map((item, index) => (
        <li className={item.done ? 'timeline-done' : ''} key={`${item.label}-${index}`}>
          <span className="timeline-marker">{item.done && <Check size={11} />}</span>
          <span className="timeline-copy"><strong>{item.label}</strong><small>{item.time}</small></span>
        </li>
      ))}
    </ol>
  );
}
