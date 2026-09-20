export default function Input({ label, error, id, ...props }) {
  return <label className="ui-field">{label && <span className="ui-field-label">{label}</span>}<input id={id} className="ui-input" aria-invalid={Boolean(error)} {...props} />{error && <span className="ui-field-error">{error}</span>}</label>;
}
