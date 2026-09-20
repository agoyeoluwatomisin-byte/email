export default function Toggle({ checked, onChange, label, disabled = false }) {
  return <label className="ui-toggle"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} disabled={disabled} /><span className="ui-toggle-track" aria-hidden="true"><span /></span>{label && <span>{label}</span>}</label>;
}
