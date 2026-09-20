import MailIcon from '../MailIcon';

export default function IconButton({ icon = 'more', label, size = 18, variant = 'ghost', ...props }) {
  return <button className={`ui-icon-button ui-icon-button-${variant}`} aria-label={label} title={label} {...props}><MailIcon name={icon} size={size} /></button>;
}
