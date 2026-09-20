export default function Textarea({ label, error, id, ...props }) {
  return (
    <label className="ui-field">
      {label && <span className="ui-field-label">{label}</span>}
      <textarea id={id} className="ui-input ui-textarea" aria-invalid={Boolean(error)} {...props} />
      {error && <span className="ui-field-error">{error}</span>}
    </label>
  );
}
