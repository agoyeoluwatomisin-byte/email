export default function PageHeader({ title, description, actions, eyebrow }) {
  return <header className="ui-page-header"><div>{eyebrow && <div className="ui-eyebrow">{eyebrow}</div>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="ui-page-actions">{actions}</div>}</header>;
}
