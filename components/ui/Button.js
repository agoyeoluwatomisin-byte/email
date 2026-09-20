export default function Button({
  children,
  variant = 'secondary',
  loading = false,
  className = '',
  disabled,
  ...props
}) {
  return (
    <button className={`ui-button ui-button-${variant} ${className}`} disabled={disabled || loading} {...props}>
      {loading ? 'Loading…' : children}
    </button>
  );
}
