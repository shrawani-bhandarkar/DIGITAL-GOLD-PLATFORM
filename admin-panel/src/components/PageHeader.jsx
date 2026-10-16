export default function PageHeader({ eyebrow, title, description, actions, children }) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <div className="page-eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      <div className="page-header-actions">{actions}{children}</div>
    </div>
  );
}
