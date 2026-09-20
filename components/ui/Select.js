export default function Select({ label, error, id, children, ...props }) {
  return <label className="ui-field">{label && <span className="ui-field-label">{label}</span>}<select id={id} className="ui-input" aria-invalid={Boolean(error)} {...props}>{children}</select>{error && <span className="ui-field-error">{error}</span>}</label>;
}
